# Brand Guidelines — ComfyReads

> *"Books have vibes. Finally, an app that gets it."*

---

## Brand Essence

ComfyReads sits at the intersection of **literary culture** and **social gaming**. It's warm and witty, not cold and algorithmic. It feels like your most well-read friend — one who has strong opinions, uses the word "atmospheric" unironically, and sends you voice notes about plot twists at midnight.

The product is fun-first. The AI is the engine, never the face.

---

## Name & Wordmark

- **Product name:** ComfyReads (one word, capital B and V)
- **Never write:** Bookvibes / BOOKVIBES / book vibes / bv
- **Tagline:** *"Books have vibes. Finally, an app that gets it."*
- **Short tagline (for cards, badges):** *"Your vibe, your shelf."*

---

## Voice & Tone

### Personality pillars

| Pillar | What it means | What it doesn't mean |
|---|---|---|
| **Warm** | Encouraging, like a reading buddy | Sycophantic or over-the-top enthusiastic |
| **Witty** | Dry humour, bookish references, a wink | Trying too hard, Gen Z slang for its own sake |
| **Direct** | Says what it means | Blunt or dismissive |
| **Curious** | Asks good questions, genuinely interested | Nosy or presumptuous |

### Voice examples

**Do:**
- "You've finished 3 thrillers in a row. Your cortisol must be thriving."
- "Eighty-seven pages and you're already in your feelings. Respect."
- "This one's been sitting on a lot of shelves. Yours included, now."

**Don't:**
- "Great job adding a book! 🎉🎉🎉"
- "AI-powered recommendations just for YOU!!!"
- "Wow, amazing review! Keep up the great work!"

### Writing rules

1. **Never use exclamation marks more than once per screen.** If everything is exciting, nothing is.
2. **Avoid passive voice** in UI copy. "Your taste profile updated" → "We updated your taste profile."
3. **Use second person ("you")** everywhere. Never "the user."
4. **Contractions are fine** — "you've", "it's", "we're" — they sound human.
5. **Humour is dry, not silly.** The app is playful but it respects readers.
6. **Short sentences win.** Especially on mobile. Especially on badges and toasts.

---

## Visual Identity

### Colour System

#### Primary Palette

| Name | Hex | Use |
|---|---|---|
| **Ink** | `#1a1a2e` | Primary text, backgrounds (dark mode) |
| **Page** | `#f5f0e8` | Background (light mode), card surfaces |
| **Ember** | `#c0392b` | Primary CTA, XP bar, active states |
| **Gold** | `#d4a574` | Accents, streak highlights, achievement badges |

#### Vibe Palettes (generated per card — not for UI chrome)

These palettes live only on Vibe Cards. They are not used in app UI.

| Palette | Background | Accent | Text |
|---|---|---|---|
| Ember | `#1a0a00` | `#c0392b` | `#f39c12` |
| Hearthside | `#3d2b1f` | `#d4a574` | `#f5e6d3` |
| Dusk | `#1a1a2e` | `#7b7fc4` | `#e8e8f0` |
| Midnight | `#0d0d0d` | `#2c3e50` | `#e74c3c` |
| Citrus | `#fff9e6` | `#f0c040` | `#ff6b35` |

#### Accessibility

- All text must pass WCAG AA contrast (4.5:1 minimum)
- Ember on Page: ✅ passes
- Gold on Ink: ✅ passes
- Never place Gold on Page (fails contrast)

### Typography

| Role | Typeface | Weight | Size |
|---|---|---|---|
| Display / Hero | Playfair Display | Bold | 32–48px |
| Headings | Playfair Display | SemiBold | 20–28px |
| Body | Inter | Regular | 16px |
| Labels / UI | Inter | Medium | 12–14px |
| Vibe Card quote | Playfair Display | Italic | 18–22px |

**Fallback stack:** `"Playfair Display", Georgia, serif` / `"Inter", system-ui, sans-serif`

### Spacing & Layout

- Base unit: **8px**
- Card padding: **24px**
- Section gap: **48px**
- Border radius: **12px** (cards), **8px** (buttons), **999px** (badges/chips)

### Iconography

- Use **Lucide** icon set throughout (consistent with the React dependency already in the stack)
- Icons are always `20px` in body contexts, `16px` in labels
- Never mix icon sets in the same view

---

## Vibe Cards

Vibe Cards are the primary social sharing artefact. They must be:

- **1200 × 630px** (OG image spec — renders correctly on Twitter/X, iMessage, Instagram stories)
- **One AI-generated quote** (≤ 140 characters, italic, centred)
- **Book title + author** in small caps at bottom
- **User's star rating** rendered as filled/empty circles (not emoji stars)
- **Vibe palette** selected by mood tags (see Palette Map in agents.md)
- **ComfyReads wordmark** bottom-right, always in Page colour regardless of palette

Cards must never show the user's name or avatar unless they explicitly opt in.

---

## Gamification Language

| Element | Label | Format |
|---|---|---|
| Points | XP | "240 XP" (always uppercase, no space before XP) |
| Daily consistency | Streak | "🔥 7-day streak" |
| User level | Reader Level | "Level 4 — The Annotator" |
| Competitive event | Vibe Battle | "Vibe Battle: You vs. @readingnerdjess" |

### Level Names (in order)

1. The Skimmer
2. The Commuter
3. The One-More-Chapter
4. The Annotator
5. The Recommender
6. The Completionist
7. The Lore Keeper
8. The Bibliophile
9. The Arbiter of Taste
10. The Oracle

---

## What ComfyReads Is Not

These guardrails help keep the product identity sharp:

- **Not a Goodreads clone.** Goodreads is a database. ComfyReads is a taste engine.
- **Not an AI chatbot.** Users don't talk to the AI. The AI shapes their experience invisibly.
- **Not a social network.** Social features (Vibe Battles, leaderboards) serve engagement, not connection for its own sake.
- **Not serious.** This is a game with a library. The tone should never drift into academic or corporate.
