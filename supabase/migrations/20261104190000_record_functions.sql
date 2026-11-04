-- Save, review and delete as single database calls, so a record and its new version row are always
-- written together. The edge function calls these through supabase.rpc with the service role.

-- Saves a record (new or existing) and adds the next version. Returns the new version number.
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
    (id, title, status, cataloger, document, metadata, current_version, created_at, updated_at,
     approved_by, approved_at)
  values
    (p_id, coalesce(nullif(p_title, ''), 'Untitled'), p_status, p_cataloger, p_document,
     coalesce(p_metadata, '{}'::jsonb), 1, p_saved_at, p_saved_at, p_approved_by, p_approved_at)
  on conflict (id) do update set
    title           = excluded.title,
    status          = excluded.status,
    cataloger       = excluded.cataloger,
    document        = excluded.document,
    metadata        = excluded.metadata,
    current_version = r.current_version + 1,
    updated_at      = excluded.updated_at,
    approved_by     = coalesce(excluded.approved_by, r.approved_by),
    approved_at     = coalesce(excluded.approved_at, r.approved_at),
    deleted_at      = null
  returning current_version into v;

  insert into record_versions (record_id, version, title, status, document, metadata, saved_by, saved_at, note)
  select id, v, title, status, document, metadata, p_saved_by, p_saved_at, p_note
  from records where id = p_id;

  return v;
end
$$;

-- The Super Admin publishes (complete) or returns (needs-review) a record. The decision becomes a
-- version of its own. Returns the new version number, or null when the record does not exist.
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
    status          = p_status,
    current_version = current_version + 1,
    updated_at      = p_at,
    reviewed_by     = p_by,
    reviewed_at     = p_at,
    approved_by     = case when p_status = 'complete' then p_by else approved_by end,
    approved_at     = case when p_status = 'complete' then p_at else approved_at end,
    metadata        = metadata || jsonb_build_object('status', p_status)
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

-- Soft delete: the record leaves every list and read, but it and its versions stay restorable.
create or replace function public.moon_delete_record(p_id text, p_at timestamptz)
returns boolean
language sql
set search_path = public
as $$
  update records set deleted_at = p_at where id = p_id and deleted_at is null returning true;
$$;

-- Only the service role calls these; PostgREST would otherwise expose them to the public anon key.
revoke all on function public.moon_save_record(text, text, text, text, jsonb, jsonb, text, timestamptz, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.moon_review_record(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.moon_delete_record(text, timestamptz) from public, anon, authenticated;
