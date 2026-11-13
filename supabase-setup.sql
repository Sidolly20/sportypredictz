-- SportyPredictz - Supabase setup. SAFE TO RUN MORE THAN ONCE, even if you ran an earlier version.
-- Run it in: Supabase -> SQL Editor -> New query -> paste everything -> Run.
-- It only adds what is missing. It never deletes rows.

-- 1) Permanent record of our picks (pick_log)
create table if not exists pick_log (
  match_id    bigint primary key,
  kickoff     timestamptz not null,
  league      text,
  home        text,
  away        text,
  pick_k      text,
  pick_label  text,
  pick_pct    numeric,
  pick_odd    numeric,
  home_goals  int,
  away_goals  int,
  result      text,            -- 'won' or 'lost' once the match is finished
  created_at  timestamptz default now()
);
alter table pick_log add column if not exists home_goals int;
alter table pick_log add column if not exists away_goals int;
alter table pick_log add column if not exists result text;
alter table pick_log enable row level security;   -- locked: only the server's service key can read/write

-- 2) Match store: a copy of every match and result, so pages still work when odds-api is down
create table if not exists match_store (
  id          bigint primary key,
  day         text,                             -- site-timezone date, e.g. 2026-11-06
  kickoff     timestamptz,
  final       boolean not null default false,   -- true once the full-time score is saved
  data        jsonb,                            -- the whole match object the page needs
  updated_at  timestamptz default now()
);
-- Bring an older match_store up to date (adds only the columns that are missing):
alter table match_store add column if not exists day text;
alter table match_store add column if not exists kickoff timestamptz;
alter table match_store add column if not exists final boolean not null default false;
alter table match_store add column if not exists data jsonb;
alter table match_store add column if not exists updated_at timestamptz default now();
create index if not exists match_store_day on match_store (day);
create index if not exists match_store_final_day on match_store (final, day);
alter table match_store enable row level security;   -- locked: only the server's service key can read/write

-- Daily standings snapshot: one row per league per day, used for "climbers and sinkers" over a week.
create table if not exists standings_snapshot (
  league_id  bigint not null,
  snap_day   text not null,            -- site-timezone date, e.g. 2026-11-06
  rows       jsonb not null,           -- [{team, pos, p, pts, gd}, ...]
  primary key (league_id, snap_day)
);
alter table standings_snapshot enable row level security;   -- locked: only the server's service key can read/write

-- Accumulator slips: one row per bet size per day (the automatic slip once a game has started, or a hand-made one from /admin).
create table if not exists acca_slips (
  day        text not null,                  -- site-timezone date, e.g. 2026-11-13
  slug       text not null,                  -- e.g. acca-2-odds
  mode       text not null default 'auto',   -- auto or manual
  frozen     boolean not null default false,
  tier       int not null default 0,
  legs       jsonb not null default '[]',
  updated_at timestamptz default now(),
  primary key (day, slug)
);
alter table acca_slips enable row level security;   -- locked: only the server's service key can read/write
