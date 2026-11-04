-- Who has a record open in the editor, so others are warned; and a version check on save, so a
-- save never silently overwrites one made meanwhile by someone else.

create table if not exists public.record_editors (
  record_id  text not null,
  username   text not null,
  started_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (record_id, username)
);
alter table public.record_editors enable row level security;

-- Called every half minute while someone has a record open. Marks them as editing it and returns the
-- others who were active on it within p_active_seconds, as [{username, since, lastSeen}], oldest first.
create or replace function public.moon_editing_heartbeat(p_id text, p_user text, p_active_seconds integer default 90)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  delete from record_editors where last_seen < now() - interval '1 hour';
  insert into record_editors as e (record_id, username) values (p_id, p_user)
  on conflict (record_id, username) do update set
    -- Coming back after going quiet starts a new session.
    started_at = case when e.last_seen < now() - make_interval(secs => p_active_seconds) then now() else e.started_at end,
    last_seen  = now();
  return coalesce((
    select jsonb_agg(jsonb_build_object('username', username, 'since', started_at, 'lastSeen', last_seen) order by started_at)
    from record_editors
    where record_id = p_id and username <> p_user and last_seen > now() - make_interval(secs => p_active_seconds)
  ), '[]'::jsonb);
end
$$;

-- Called when someone closes the record or leaves the editor.
create or replace function public.moon_editing_leave(p_id text, p_user text)
returns void
language sql
set search_path = public
as $$
  delete from record_editors where record_id = p_id and username = p_user;
$$;

-- The save function gains p_base_version: the version the editor started from. When it is given and the
-- record has moved on since, nothing is saved and the error 'version_conflict:<current version>' is raised.
drop function if exists public.moon_save_record(text, text, text, text, jsonb, jsonb, text, timestamptz, text, text, timestamptz);

create function public.moon_save_record(
  p_id           text,
  p_title        text,
  p_status       text,
  p_cataloger    text,
  p_document     jsonb,
  p_metadata     jsonb,
  p_saved_by     text,
  p_saved_at     timestamptz,
  p_note         text default 'save',
  p_approved_by  text default null,
  p_approved_at  timestamptz default null,
  p_base_version integer default null
) returns integer
language plpgsql
set search_path = public
as $$
declare
  v integer;
  cur integer;
begin
  if p_base_version is not null then
    select current_version into cur from records where id = p_id and deleted_at is null for update;
    if cur is not null and cur <> p_base_version then
      raise exception 'version_conflict:%', cur;
    end if;
  end if;

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

revoke all on function public.moon_save_record(text, text, text, text, jsonb, jsonb, text, timestamptz, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.moon_editing_heartbeat(text, text, integer) from public, anon, authenticated;
revoke all on function public.moon_editing_leave(text, text) from public, anon, authenticated;
