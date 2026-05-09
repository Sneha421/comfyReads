# ComfyReads

ComfyReads is a gamified reading taste app built with Next.js, Supabase, and OpenAI. It lets you add books to a visual shelf, mark them as `Reading` or `Read`, write reviews, extract taste signals, generate recommendations, create a reader vibe card, compare shelves with friends, and chat with a shelf-aware reading agent.

The app is intentionally opinionated: warm bookish UI, dark recommendation surfaces, game-like XP feedback, and short dry copy.

## Features

- **Visual bookshelf:** Books are displayed as spines split into `Reading now` and `Read` shelves.
- **Book enrichment:** Adding a book enriches metadata with Open Library, Exa, and OpenAI.
- **Reviews:** Star rating, review text, vibe tags, extracted taste signals, and review result cards.
- **Recommendations:** Personalized recommendations based on taste profile and optional mood override.
- **Gamification:** XP, streaks, levels, level names, and animated XP popups.
- **Reader vibe card:** One shareable vibe card per user, generated from reviews, ratings, vibe tags, and book moods.
- **Stats:** Level, XP progress, streak, book count, review count, average rating, and top vibe tag.
- **Friends prototype:** Add sample friends, view their levels/shelves, find shared books, and group-comment locally.
- **Shelf Agent:** A chat agent that can discuss your shelf, reviews, reading taste, recommendations, and music suggestions.

## Tech Stack

- **Framework:** Next.js 14 App Router
- **UI:** React, TypeScript, Tailwind CSS, custom CSS
- **Database:** Supabase Postgres
- **AI:** OpenAI SDK
- **Search/enrichment:** Exa API, Open Library API
- **Icons:** lucide-react

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
EXA_API_KEY=your_exa_api_key
```

Create the Supabase tables using:

```bash
supabase/schema.sql
```

Run the development server:

```bash
npm run dev
```

Open the local URL printed by Next.js, usually:

```bash
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Main Routes

- `/shelf` - visual bookshelf, add books, mark books as reading/read.
- `/review/[book_id]` - write a review and generate review analysis.
- `/recommendations` - personalized recommendation shelf with mood override.
- `/stats` - XP, level, streak, reader stats, and reader vibe card generation.
- `/friends` - social prototype with friends, shelves, and shared-book comments.
- `/agent` - Shelf Agent chat.

The root route redirects to `/shelf`.

## API Routes

- `GET /api/books?user_id=...` - list books for a user.
- `POST /api/books/add` - add and enrich a book.
- `POST /api/books/status` - update `reading` / `read` status.
- `POST /api/reviews/add` - add a review and extract taste signals.
- `GET /api/recommendations?user_id=...&mood_override=...` - generate recommendations.
- `GET /api/stats?user_id=...` - level, XP, streak summary.
- `GET /api/stats/detail?user_id=...` - shelf/review counts and taste stats.
- `POST /api/vibecard` - generate one user-level vibe card.
- `POST /api/agent/chat` - Shelf Agent chat response.

## Data Model

The Supabase schema lives in:

```bash
supabase/schema.sql
```

Core tables:

- `books`
- `reviews`
- `taste_profile`
- `recommendations`
- `vibe_cards`
- `xp_events`
- `user_stats`
- `agent_logs`

The current app uses a hardcoded development user:

```ts
export const USER_ID = "dev-user-1";
```

This is defined in `lib/user.ts` and normalized through `lib/user-id.ts`.

## AI Pipeline

ComfyReads follows a multi-agent style pipeline:

- **Book enrichment:** Adds metadata like genre, mood, themes, setting, pacing, and era.
- **Review analysis:** Extracts liked/disliked signals, vibe tags, emotional intensity, and quote material.
- **Recommendation generation:** Uses the taste profile plus optional mood override to rank books.
- **Vibe card generation:** Builds one user-level card from reviewed books and review signals.
- **Gamification:** Awards XP and updates streak/level data after write actions.
- **Shelf Agent:** Provides chat responses using shelf, review, and taste-profile context.

## Prototype Notes

- Auth is not implemented yet. The app uses `dev-user-1`.
- Friend data and group comments are local prototype data stored in `localStorage`.
- Book status has a local fallback for environments where `books.status` has not been added yet.
- Vibe cards are returned as sandboxed HTML iframes, not image files.
- Recommendations depend on Exa/OpenAI availability, with a local fallback catalog.

## Design Direction

The current visual system is built around:

- Dark ink navigation and HUD surfaces.
- Warm shelf scenes.
- Dark “night shelf” recommendations.
- Playfair Display for headings.
- Inter for UI/body text.
- Game-like XP popups and level progression.

Core colors are defined as CSS variables in `src/app/globals.css`.

## Development Tips

- If recommendations feel unrelated, check `mood_override` handling in `src/app/api/recommendations/route.ts`.
- If book status is not persisting to Supabase, make sure the `books.status` column exists from the latest schema.
- If the Shelf Agent returns fallback copy, verify `OPENAI_API_KEY`.
- If book enrichment is sparse, verify `EXA_API_KEY` and Open Library reachability.

## License

Private prototype. No license has been selected yet.
