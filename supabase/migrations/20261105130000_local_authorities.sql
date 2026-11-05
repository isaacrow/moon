-- Moon's local authority file: people and organizations (agent), places and topics that LC and VIAF
-- may not know, each with a permanent https://mooon.site/resource/<kind>/<id> address, variant names,
-- sameAs links to LC / VIAF / Wikidata, and the details gathered for it. A merged entry forwards to the
-- entry it was merged into.

-- A name and its variants as one normalized search string (array_to_string is only stable, so it is
-- wrapped here to be usable in a generated column; the result depends on its inputs alone).
create or replace function public.moon_names_text(p_label text, p_variants text[])
returns text
language sql
immutable
parallel safe
as $$
  select public.moon_normalize(p_label || ' ' || array_to_string(coalesce(p_variants, '{}'), ' '))
$$;

create table if not exists public.authorities (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  kind        text not null check (kind in ('agent', 'place', 'topic')),
  label       text not null check (length(btrim(label)) between 1 and 300),
  variants    text[] not null default '{}',
  same_as     text[] not null default '{}',
  note        text,
  data        jsonb not null default '{}'::jsonb,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  merged_into text references public.authorities (id),
  name_key    text generated always as (public.moon_normalize(label)) stored,
  search_text text generated always as (public.moon_names_text(label, variants)) stored
);
create index if not exists authorities_name_key_idx on public.authorities (kind, name_key) where merged_into is null;
alter table public.authorities enable row level security;

create or replace function public.moon_authority_json(a public.authorities)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('id', a.id, 'kind', a.kind, 'label', a.label, 'variants', to_jsonb(a.variants),
    'sameAs', to_jsonb(a.same_as), 'note', a.note, 'data', a.data, 'createdBy', a.created_by,
    'createdAt', a.created_at, 'updatedAt', a.updated_at, 'mergedInto', a.merged_into)
$$;

-- Adds an entry, unless one of the same kind already has this name (any spelling, or as a variant):
-- then that one is returned with existing = true, so the file never holds the same person twice.
create or replace function public.moon_add_authority(
  p_id text, p_kind text, p_label text, p_variants text[], p_same_as text[], p_note text, p_data jsonb, p_by text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  found authorities;
  made authorities;
begin
  select * into found from authorities
  where kind = p_kind and merged_into is null
    and (name_key = moon_normalize(p_label)
         or moon_normalize(p_label) = any (select moon_normalize(v) from unnest(variants) v))
  order by created_at
  limit 1;
  if found.id is not null then
    return jsonb_build_object('existing', true, 'authority', moon_authority_json(found));
  end if;
  insert into authorities (id, kind, label, variants, same_as, note, data, created_by)
  values (p_id, p_kind, btrim(p_label),
          array(select distinct btrim(v) from unnest(coalesce(p_variants, '{}')) v where btrim(v) <> '' and btrim(v) <> btrim(p_label)),
          array(select distinct btrim(s) from unnest(coalesce(p_same_as, '{}')) s where btrim(s) ~ '^https?://'),
          nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_data, '{}'::jsonb), p_by)
  returning * into made;
  return jsonb_build_object('existing', false, 'authority', moon_authority_json(made));
end
$$;

-- Entries matching every word of the query (names and variants, Arabic spellings folded), newest first.
create or replace function public.moon_search_authorities(p_query text, p_kind text default null, p_limit integer default 20)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(moon_authority_json(a) order by a.updated_at desc), '[]'::jsonb)
  from (
    select * from authorities a
    where merged_into is null and (p_kind is null or kind = p_kind)
      and not exists (select 1 from unnest(array_remove(regexp_split_to_array(moon_normalize(p_query), ' '), '')) w
                      where position(w in a.search_text) = 0)
    order by updated_at desc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) a
$$;

create or replace function public.moon_get_authority(p_id text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select moon_authority_json(a) from authorities a where id = p_id
$$;

-- Merges p_from into p_into (same kind): p_into gains p_from's name and variants and sameAs links, and
-- p_from forwards to it from then on. Refuses merging into itself, across kinds, or into a merged entry.
create or replace function public.moon_merge_authority(p_from text, p_into text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  a authorities;
  b authorities;
begin
  select * into a from authorities where id = p_from and merged_into is null;
  select * into b from authorities where id = p_into and merged_into is null;
  if a.id is null or b.id is null or a.id = b.id or a.kind <> b.kind then
    return false;
  end if;
  update authorities set
    variants   = array(select distinct v from unnest(b.variants || a.variants || array[a.label]) v where v <> b.label),
    same_as    = array(select distinct s from unnest(b.same_as || a.same_as) s),
    updated_at = now()
  where id = b.id;
  -- Entries already forwarding to the old one now forward to the new one.
  update authorities set merged_into = b.id, updated_at = now() where id = a.id or merged_into = a.id;
  return true;
end
$$;

revoke all on function public.moon_add_authority(text, text, text, text[], text[], text, jsonb, text) from public, anon, authenticated;
revoke all on function public.moon_search_authorities(text, text, integer) from public, anon, authenticated;
revoke all on function public.moon_get_authority(text) from public, anon, authenticated;
revoke all on function public.moon_merge_authority(text, text) from public, anon, authenticated;
revoke all on function public.moon_authority_json(public.authorities) from public, anon, authenticated;
