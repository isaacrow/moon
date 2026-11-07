-- Phase 13 S18, step 1: who said an entity is the same as an outside one, when, and how. Each outside link
-- (LC, VIAF, Wikidata …) on an entity keeps its source: a person, Moon's reconcile match (with its confidence
-- and reasons), a record or an import. Machines draft, people decide: a machine match keeps its evidence.
-- The first statement of a link is kept; adding the same link again does not overwrite who added it.

create table if not exists public.authority_link_sources (
  authority_id text not null references public.authorities (id) on delete cascade,
  uri          text not null check (uri ~ '^https?://' and length(uri) <= 300),
  added_by     text not null,
  added_at     timestamptz not null default now(),
  method       text not null check (method in ('person', 'reconcile', 'record', 'import')),
  confidence   numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence     text check (evidence is null or length(evidence) <= 500),
  primary key (authority_id, uri)
);
alter table public.authority_link_sources enable row level security;

create or replace function public.moon_add_link_source(
  p_id text, p_uri text, p_by text, p_method text, p_confidence numeric, p_evidence text
) returns boolean
language sql
set search_path = public
as $$
  with made as (
    insert into authority_link_sources (authority_id, uri, added_by, method, confidence, evidence)
    values (p_id, p_uri, p_by, p_method, p_confidence, nullif(btrim(coalesce(p_evidence, '')), ''))
    on conflict (authority_id, uri) do nothing
    returning 1
  )
  select exists (select 1 from made)
$$;

create or replace function public.moon_link_sources(p_id text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('uri', uri, 'addedBy', added_by, 'addedAt', added_at, 'method', method,
           'confidence', confidence, 'evidence', evidence) order by added_at), '[]'::jsonb)
  from authority_link_sources where authority_id = p_id
$$;

revoke all on function public.moon_add_link_source(text, text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.moon_link_sources(text) from public, anon, authenticated;
