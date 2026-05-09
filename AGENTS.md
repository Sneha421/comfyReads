# agents.md — ComfyReads AI Agent Architecture

## Overview

ComfyReads uses a multi-agent pipeline. Each agent has a single responsibility, a clear input/output contract, and fails gracefully. No agent calls another directly — they communicate through a shared Supabase PostgreSQL database.

## Supabase Schema

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  author text,
  isbn text unique,
  pages int,
  year int,
  genre text[],
  mood text[],
  themes text[],
  setting text,
  pacing text check (pacing in ('slow-burn','

---

## Agent 1: Book Enrichment Agent

**Trigger:** User adds a book (title + optional author)  
**Goal:** Return structured metadata — genre, mood, themes, era, setting, pacing

### Flow

```
User adds book
  → Agent calls Exa semantic search: "Book Title Author themes genre mood"
  → Agent calls Open Library API: ISBN, page count, publish year
  → Agent merges, normalises, and writes to Convex `books` table
```

### Input

```json
{ "title": "string", "author": "string (optional)" }
```

### Output (written to Convex)

```json
{
  "title": "The Name of the Wind",
  "author": "Patrick Rothfuss",
  "isbn": "9780756404741",
  "pages": 662,
  "year": 2007,
  "genre": ["fantasy", "coming-of-age"],
  "mood": ["epic", "introspective", "lyrical"],
  "themes": ["magic systems", "unreliable narrator", "found family"],
  "setting": "medieval fantasy world",
  "pacing": "slow-burn",
  "era": "2000s"
}
```

### Sanity Checks

- [ ] If Exa returns no results, fall back to Open Library subject tags
- [ ] If both fail, store book with `enriched: false` and queue for manual retry
- [ ] Genre must be an array (never a string); normalise before write
- [ ] Deduplicate books by ISBN before inserting; surface conflict to user

---

## Agent 2: Review Analysis Agent

**Trigger:** User submits a review + star rating  
**Goal:** Extract taste signals — liked/disliked elements, emotional response, intensity

### Flow

```
User submits review text + rating (1–5)
  → Agent sends review to GPT with structured extraction prompt
  → GPT returns JSON: liked[], disliked[], vibe_tags[], emotional_intensity
  → Agent writes taste signals to Convex `taste_profile` table (append + reweight)
```

### Input

```json
{
  "book_id": "string",
  "review_text": "string",
  "rating": 1-5
}
```

### Output (written to Convex)

```json
{
  "liked": ["magic systems", "slow reveals", "unreliable narrator"],
  "disliked": ["info-dumps", "romance subplot"],
  "vibe_tags": ["cozy-epic", "brain-full"],
  "emotional_intensity": 0.82,
  "quote_for_vibe_card": "The story felt like a campfire — warm, crackling, impossible to look away from."
}
```

### Sanity Checks

- [ ] `rating` must be integer 1–5; reject otherwise
- [ ] `review_text` minimum 10 characters; prompt user if shorter
- [ ] `quote_for_vibe_card` must be ≤ 140 characters; ask GPT to shorten if over
- [ ] `emotional_intensity` must be float 0.0–1.0; clamp if out of range
- [ ] Low-rating reviews should populate `disliked[]` not `liked[]` — prompt design must enforce this
- [ ] If review_text is empty, still extract signals from rating alone (rating-only path)

---

## Agent 3: Recommendation Agent

**Trigger:** User requests recommendations, or automatically after each new review  
**Goal:** Return 5 ranked books personalised to current taste profile

### Flow

```
Read current taste_profile from Convex
  → Build semantic query string from liked[], vibe_tags[], current mood input
  → Call Exa neural search with query
  → Filter out already-read books (check Convex `books` table)
  → Rank by Adaptation Labs relevance scoring
  → Write ranked list to Convex `recommendations` table
  → Return to UI
```

### Input

```json
{
  "user_id": "string",
  "mood_override": "string (optional — e.g. 'something light today')"
}
```

### Output

```json
{
  "recommendations": [
    {
      "rank": 1,
      "title": "The Lies of Locke Lamora",
      "author": "Scott Lynch",
      "reason": "Your love of intricate magic systems and unreliable narrators maps directly here — plus zero romance subplots.",
      "confidence": 0.91
    }
  ]
}
```

### Sanity Checks

- [ ] Never recommend a book already in user's `books` table (read or DNF)
- [ ] `confidence` must be 0.0–1.0; normalise if outside range
- [ ] If taste_profile is empty (new user), fall back to `popular_by_genre` cold-start path
- [ ] Minimum 3 recommendations returned; if Exa returns fewer, broaden query and retry once
- [ ] Reason string must be personalised (reference actual user signals, not generic copy)
- [ ] Reason string max 200 characters for UI fit

---

## Agent 4: Vibe Card Generator Agent

**Trigger:** User completes a review (rating submitted)  
**Goal:** Generate a shareable aesthetic vibe card with AI quote + mood palette

### Flow

```
Pull book metadata + review analysis output
  → Call GPT: generate 1-sentence vibe quote (≤ 140 chars)
  → Select palette from mood → palette map
  → Render card as HTML/Canvas in frontend
  → Store card_url in Convex `vibe_cards` table
```

### Palette Map

| Mood tags | Palette name | Colors |
|---|---|---|
| epic, dark | Ember | #1a0a00 · #c0392b · #f39c12 |
| cozy, warm | Hearthside | #3d2b1f · #d4a574 · #f5e6d3 |
| lyrical, introspective | Dusk | #1a1a2e · #7b7fc4 · #e8e8f0 |
| thriller, tense | Midnight | #0d0d0d · #2c3e50 · #e74c3c |
| light, fun | Citrus | #fff9e6 · #f0c040 · #ff6b35 |

### Sanity Checks

- [ ] Quote must be ≤ 140 characters — hard truncate with ellipsis if GPT exceeds
- [ ] Quote must not contain the book title verbatim (too on-the-nose)
- [ ] Palette must always resolve — fallback to Dusk if mood tags don't match any key
- [ ] Card must render at 1200×630px for OG share preview

---

## Agent 5: Gamification Agent

**Trigger:** Any write event (review added, book added, streak continued)  
**Goal:** Award XP, update streaks, check badge conditions, write to leaderboard

### XP Table

| Action | XP |
|---|---|
| Add a book | +10 |
| Submit a review (< 50 words) | +20 |
| Submit a review (≥ 50 words) | +40 |
| Daily streak continued | +15 |
| Vibe battle win | +50 |
| Complete a reading challenge | +100 |

### Sanity Checks

- [ ] XP is append-only — never subtract (prevents negative UX on corrections)
- [ ] Streak logic: streak continues if user logs activity on consecutive calendar days (UTC); reset to 0 on miss
- [ ] Badge checks run after every XP event — don't batch (latency acceptable, real-time feel matters)
- [ ] Leaderboard updates must be idempotent — use Convex mutations with conflict resolution

---

## Shared Conventions

- All agents write to Convex; none read from each other directly
- All GPT API calls use `gpt-4o`
- All agents return structured JSON; never return raw prose to the app layer
- Retry budget: 2 retries with exponential backoff, then mark job failed and surface to user
- Every agent logs `agent_name`, `trigger`, `duration_ms`, `success` to Convex `agent_logs`
