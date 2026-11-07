-- Phase 12: the entity file in numbers, for the linked-data audit: how many entities (not merged) there are,
-- by kind, and how many link to LC, VIAF, Wikidata, FAST, ISNI or ORCID.
create or replace function public.moon_authority_stats()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'withOutsideLinks', count(*) filter (where coalesce(array_length(same_as, 1), 0) > 0),
    'byKind', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) as n from authorities where merged_into is null group by kind) k), '{}'::jsonb)
  )
  from authorities
  where merged_into is null
$$;

revoke all on function public.moon_authority_stats() from public, anon, authenticated;
