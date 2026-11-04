-- Revisions: a published record stays in the catalogue while an edit to it waits for review.
-- records.status and records.document describe the working copy (the latest version); the public
-- catalogue shows published_version instead, which only a Super Admin save, approval or revert moves.

alter table public.records
  add column if not exists published_version integer check (published_version >= 1);

-- Every record that is published today is live at its current version.
update public.records
set published_version = current_version
where status = 'complete' and published_version is null;

-- The catalogue's view of each published record: the published version's title and document.
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
       r.current_version
from public.records r
join public.record_versions v on v.record_id = r.id and v.version = r.published_version
where r.deleted_at is null;

revoke all on public.published_records from public, anon, authenticated;

-- Same as before, plus: a save with status complete (the Super Admin's) publishes the new version.
create or replace function public.moon_save_record(
  p_id          text,
  p_title       text,
  p_status      text,
  p_cataloger   text,
  p_document    jsonb,
  p_metadata    jsonb,
  p_saved_by    text,
  p_saved_at    timestamptz,
  p_note        text default 'save',
  p_approved_by text default null,
  p_approved_at timestamptz default null
) returns integer
language plpgsql
set search_path = public
as $$
declare
  v integer;
begin
  insert into records as r
    (id, title, status, cataloger, document, metadata, current_version, published_version,
     created_at, updated_at, approved_by, approved_at)
  values
    (p_id, coalesce(nullif(p_title, ''), 'Untitled'), p_status, p_cataloger, p_document,
     coalesce(p_metadata, '{}'::jsonb), 1, case when p_status = 'complete' then 1 end,
     p_saved_at, p_saved_at, p_approved_by, p_approved_at)
  on conflict (id) do update set
    title             = excluded.title,
    status            = excluded.status,
    cataloger         = excluded.cataloger,
    document          = excluded.document,
    metadata          = excluded.metadata,
    current_version   = r.current_version + 1,
    -- A deleted record comes back unpublished unless this save publishes it.
    published_version = case when excluded.status = 'complete' then r.current_version + 1
                             when r.deleted_at is not null then null
                             else r.published_version end,
    updated_at        = excluded.updated_at,
    approved_by       = coalesce(excluded.approved_by, r.approved_by),
    approved_at       = coalesce(excluded.approved_at, r.approved_at),
    deleted_at        = null
  returning current_version into v;

  insert into record_versions (record_id, version, title, status, document, metadata, saved_by, saved_at, note)
  select id, v, title, status, document, metadata, p_saved_by, p_saved_at, p_note
  from records where id = p_id;

  return v;
end
$$;

-- Same as before, plus: approving publishes the new version; returning leaves the published one live.
create or replace function public.moon_review_record(
  p_id     text,
  p_status text,
  p_by     text,
  p_at     timestamptz
) returns integer
language plpgsql
set search_path = public
as $$
declare
  v integer;
begin
  update records set
    status            = p_status,
    current_version   = current_version + 1,
    published_version = case when p_status = 'complete' then current_version + 1 else published_version end,
    updated_at        = p_at,
    reviewed_by       = p_by,
    reviewed_at       = p_at,
    approved_by       = case when p_status = 'complete' then p_by else approved_by end,
    approved_at       = case when p_status = 'complete' then p_at else approved_at end,
    metadata          = metadata || jsonb_build_object('status', p_status)
  where id = p_id and deleted_at is null
  returning current_version into v;

  if v is null then
    return null;
  end if;

  insert into record_versions (record_id, version, title, status, document, metadata, saved_by, saved_at, note)
  select id, v, title, status, document, metadata, p_by, p_at,
         case when p_status = 'complete' then 'approve' else 'return' end
  from records where id = p_id;

  return v;
end
$$;

revoke all on function public.moon_save_record(text, text, text, text, jsonb, jsonb, text, timestamptz, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.moon_review_record(text, text, text, timestamptz) from public, anon, authenticated;
