-- Duplicate detection: each record carries its identifier keys (ISBNs as ISBN-13, LCCNs) and a title key
-- (the Work's main title, normalized as for search), kept up to date by Postgres; moon_find_duplicates
-- compares a record about to be saved with every other record.

-- An ISBN as its 13-digit form, so the ISBN-10 and ISBN-13 of one book match; null when it is not an ISBN.
create or replace function public.moon_isbn13(raw text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  d text := upper(regexp_replace(coalesce(raw, ''), '[^0-9Xx]', '', 'g'));
  s integer := 0;
  i integer;
begin
  if length(d) = 13 and d ~ '^97[89][0-9]{10}$' then
    return d;
  end if;
  if length(d) = 10 and d ~ '^[0-9]{9}[0-9X]$' then
    d := '978' || substr(d, 1, 9);
    for i in 1..12 loop
      s := s + substr(d, i, 1)::integer * (case when i % 2 = 0 then 3 else 1 end);
    end loop;
    return d || ((10 - s % 10) % 10)::text;
  end if;
  return null;
end
$$;

-- Every identifier in a record that can show it is the same book: isbn:<13 digits>, lccn:<normalized>.
create or replace function public.moon_record_identifiers(doc jsonb)
returns text[]
language sql
immutable
parallel safe
as $$
  select coalesce(array_agg(distinct k order by k), '{}')
  from (
    select case
             when t ilike '%isbn%' then 'isbn:' || public.moon_isbn13(v)
             when t ilike '%lccn%' then 'lccn:' || nullif(regexp_replace(lower(v), '[^0-9a-z]', '', 'g'), '')
           end as k
    from jsonb_path_query(coalesce(doc, '{}'::jsonb), 'strict $.**') o,
         lateral (select (o -> '@type')::text as t,
                         coalesce(o #>> '{rdf:value,@value}',
                                  case when jsonb_typeof(o -> 'rdf:value') = 'string' then o ->> 'rdf:value' end,
                                  case when jsonb_typeof(o -> 'value') = 'string' then o ->> 'value' end) as v) x
    where jsonb_typeof(o) = 'object' and v is not null
  ) keys
  where k is not null
$$;

-- The Work's main title, normalized; null for missing or placeholder titles so they never match.
create or replace function public.moon_record_title_key(doc jsonb)
returns text
language sql
immutable
parallel safe
as $$
  select case when length(k) >= 4 and k not in ('untitled', 'untitled record', 'بدون عنوان') then k end
  from (
    select public.moon_normalize(coalesce(
             t ->> 'bf:mainTitle', t ->> 'mainTitle', t #>> '{bf:mainTitle,@value}', t #>> '{bf:mainTitle,0,@value}',
             t #>> '{bf:mainTitle,0}', case when jsonb_typeof(t) = 'string' then t #>> '{}' end)) as k
    from jsonb_array_elements(case jsonb_typeof(doc -> '@graph') when 'array' then doc -> '@graph' else '[]'::jsonb end) n,
         lateral (select coalesce(n -> 'bf:title', n -> 'title') as raw) r,
         lateral (select case jsonb_typeof(raw) when 'array' then raw -> 0 else raw end as t) x
    where (n -> '@type')::text ilike '%Work%'
    limit 1
  ) w
$$;

alter table public.records
  add column if not exists identifier_keys text[] generated always as (public.moon_record_identifiers(document)) stored,
  add column if not exists title_key text generated always as (public.moon_record_title_key(document)) stored;

create index if not exists records_identifier_keys_idx on public.records using gin (identifier_keys);
create index if not exists records_title_key_idx on public.records (title_key) where deleted_at is null;

-- Records (other than p_id) that look like the same book as p_doc, with why: same ISBN, same LCCN, same title.
create or replace function public.moon_find_duplicates(p_id text, p_doc jsonb)
returns jsonb
language sql
stable
set search_path = public
as $$
  with mine as (
    select moon_record_identifiers(p_doc) as ids, moon_record_title_key(p_doc) as title
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'title', r.title, 'status', r.status, 'cataloger', r.cataloger,
           'reasons', array_remove(array[
              case when exists (select 1 from unnest(r.identifier_keys) k where k like 'isbn:%' and k = any(m.ids)) then 'isbn' end,
              case when exists (select 1 from unnest(r.identifier_keys) k where k like 'lccn:%' and k = any(m.ids)) then 'lccn' end,
              case when r.title_key = m.title then 'title' end], null))
           order by r.updated_at desc), '[]'::jsonb)
  from (
    select r.* from records r, mine m
    where r.deleted_at is null and r.id <> coalesce(p_id, '')
      and (r.identifier_keys && m.ids or (m.title is not null and r.title_key = m.title))
    order by r.updated_at desc
    limit 10
  ) r, mine m
$$;

revoke all on function public.moon_find_duplicates(text, jsonb) from public, anon, authenticated;
