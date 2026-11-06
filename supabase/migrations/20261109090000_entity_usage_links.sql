-- Phase 10, step 4: an entity is used by the records that point at it and by those that point at the same
-- thing in LC, VIAF or Wikidata (a name picked from LC keeps LC's address in the record). A link is matched
-- with http and https alike.

drop function if exists public.moon_authority_usage(text);

create or replace function public.moon_authority_usage(p_uri text, p_links text[] default '{}')
returns jsonb
language sql
stable
set search_path = public
as $$
  with addresses as (
    select distinct a from (
      select btrim(x) as a from unnest(array[p_uri] || coalesce(p_links, '{}')) x
      union all
      select regexp_replace(btrim(x), '^http://', 'https://') from unnest(array[p_uri] || coalesce(p_links, '{}')) x
      union all
      select regexp_replace(btrim(x), '^https://', 'http://') from unnest(array[p_uri] || coalesce(p_links, '{}')) x
    ) s
    where a ~ '^https?://'
  ),
  used as (
    select r.id, r.title, r.updated_at from records r
    where r.deleted_at is null
      and exists (select 1 from addresses where strpos(r.document::text, '"' || addresses.a || '"') > 0)
  )
  select jsonb_build_object(
    'count', (select count(*) from used),
    'records', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title) order by updated_at desc)
                         from (select * from used order by updated_at desc limit 50) u), '[]'::jsonb))
$$;

-- Only the server (service role) calls these, as with the other entity functions; this includes the link
-- functions step 3 added.
revoke all on function public.moon_authority_usage(text, text[]) from public, anon, authenticated;
revoke all on function public.moon_find_authority_by_links(text[], text) from public, anon, authenticated;
revoke all on function public.moon_add_authority(text, text, text, text[], text[], text, jsonb, text) from public, anon, authenticated;
