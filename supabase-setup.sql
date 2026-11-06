-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
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
alter table pick_log enable row level security;  -- locked: only the server's service key can read/write
