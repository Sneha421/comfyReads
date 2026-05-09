CREATE TABLE books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  author text,
  isbn text,
  pages int,
  year int,
  genre text[],
  mood text[],
  themes text[],
  setting text,
  pacing text check (pacing in ('slow-burn', 'steady', 'fast-paced', 'variable')),
  era text,
  enriched boolean default false,
  status text not null default 'reading' check (status in ('reading', 'read')),
  created_at timestamptz default now()
);

CREATE TABLE taste_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  liked text[],
  disliked text[],
  vibe_tags text[],
  top_moods text[],
  top_themes text[],
  updated_at timestamptz default now()
);

CREATE TABLE reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  book_id uuid references books(id),
  rating int check (rating between 1 and 5),
  review_text text,
  liked text[],
  disliked text[],
  vibe_tags text[],
  emotional_intensity float,
  quote_for_vibe_card text,
  created_at timestamptz default now()
);

CREATE TABLE recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  rank int,
  title text,
  author text,
  reason text,
  confidence float,
  created_at timestamptz default now()
);

CREATE TABLE vibe_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  book_id uuid references books(id),
  review_id uuid references reviews(id),
  quote text,
  palette text,
  created_at timestamptz default now()
);

CREATE TABLE xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text,
  xp_awarded int,
  created_at timestamptz default now()
);

CREATE TABLE user_stats (
  user_id uuid primary key,
  total_xp int default 0,
  current_streak int default 0,
  last_activity_date date,
  level int default 1
);

CREATE TABLE agent_logs (
  id uuid primary key default gen_random_uuid(),
  agent_name text,
  trigger text,
  duration_ms int,
  success boolean,
  error text,
  created_at timestamptz default now()
);
