-- Phase 13 S19: the label cache. The names LC and Wikidata give the people, subjects and places Moon links
-- to, in every script they have, kept here so Moon can show them without asking LC or Wikidata each time.
-- Filled and refreshed only by the refresh job (from LC's change feed and Wikidata's modification dates);
-- never edited by hand: there is no route that writes a label.

create table if not exists public.label_cache (
  uri             text primary key check (uri ~ '^https?://' and length(uri) <= 300),
  source          text not null check (source in ('lc', 'wikidata')),
  labels          jsonb not null default '[]'::jsonb,
  source_modified text,
  fetched_at      timestamptz not null default now(),
  missing         boolean not null default false
);
alter table public.label_cache enable row level security;
create index if not exists label_cache_fetched on public.label_cache (fetched_at);

-- When the refresh job last read LC's change feed (so the next run reads only what came since).
create table if not exists public.label_cache_state (
  key   text primary key,
  value text not null
);
alter table public.label_cache_state enable row level security;
