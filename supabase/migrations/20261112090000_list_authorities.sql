-- Phase 12, step 4: every entity (not merged), for the data dump and SPARQL, so the published linked data
-- carries each person's, place's and subject's authority description and its links to LC, VIAF and Wikidata.
create or replace function public.moon_list_authorities()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(moon_authority_json(a) order by a.kind, a.id), '[]'::jsonb)
  from authorities a
  where a.merged_into is null
$$;

revoke all on function public.moon_list_authorities() from public, anon, authenticated;
