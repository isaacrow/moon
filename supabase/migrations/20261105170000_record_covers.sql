-- Record covers: one picture per record, kept in the public Storage bucket "covers" (<record id>.jpg,
-- .png or .webp) and named on the record, so lists and the OPAC show it without asking for each one.
-- A cover is not catalogue data: changing it makes no new version and needs no review.
alter table public.records
  add column if not exists cover_url text,
  add column if not exists cover_source text check (cover_source in ('upload', 'openlibrary', 'googlebooks'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The published view also carries the cover (added at the end, so the view can be replaced in place).
create or replace view public.published_records
with (security_invoker = true) as
select r.id,
       v.title,
       v.document,
       v.metadata || jsonb_build_object('status', 'complete') as metadata,
       r.cataloger,
       r.created_at,
       v.saved_at as updated_at,
       r.approved_by,
       r.approved_at,
       r.published_version,
       r.current_version,
       public.moon_normalize(v.title || ' ' || coalesce(r.cataloger, '') || ' ' || coalesce(public.moon_jsonb_text(v.document), '')) as search_text,
       v.language_code,
       v.template_id,
       r.cover_url
from public.records r
join public.record_versions v on v.record_id = r.id and v.version = r.published_version
where r.deleted_at is null;

revoke all on public.published_records from public, anon, authenticated;

-- Sets (or with null clears) a record's cover; false for a missing record.
create or replace function public.moon_set_cover(p_id text, p_url text, p_source text)
returns boolean
language sql
set search_path = public
as $$
  update records set cover_url = p_url, cover_source = case when p_url is null then null else p_source end
  where id = p_id and deleted_at is null
  returning true
$$;

revoke all on function public.moon_set_cover(text, text, text) from public, anon, authenticated;
