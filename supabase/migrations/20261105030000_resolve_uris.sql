-- Resolvable URIs: finds the published record that describes a URI (any node in its graph with that
-- @id, at any depth), so https://mooon.site/resource/... can answer with the record.
create or replace function public.moon_find_published_by_uri(p_uri text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('id', id, 'title', title, 'document', document, 'version', published_version, 'saved', updated_at)
  from published_records
  where jsonb_path_exists(document, '$.** ? (@."@id" == $u)', jsonb_build_object('u', p_uri))
  order by updated_at desc
  limit 1
$$;

revoke all on function public.moon_find_published_by_uri(text) from public, anon, authenticated;
