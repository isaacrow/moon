-- Phase 10, step 1: the authority file becomes Moon's entity store.
--   * Two more kinds: genre/form (bf:GenreForm) and period (bf:Temporal), at /resource/genre|period/<id>.
--   * Entities can be edited; each edit keeps the earlier state in authority_versions and bumps `version`,
--     and an edit names the version it started from, so two people never overwrite each other.
--   * Moon counts the records that use an entity (any record, not deleted, holding its address).

alter table public.authorities drop constraint if exists authorities_kind_check;
alter table public.authorities add constraint authorities_kind_check
  check (kind in ('agent', 'place', 'topic', 'hub', 'genre', 'period'));

alter table public.authorities add column if not exists version integer not null default 1 check (version >= 1);

create table if not exists public.authority_versions (
  authority_id text not null references public.authorities (id) on delete cascade,
  version      integer not null,
  label        text not null,
  variants     text[] not null default '{}',
  same_as      text[] not null default '{}',
  note         text,
  data         jsonb not null default '{}'::jsonb,
  changed_by   text,
  changed_at   timestamptz not null default now(),
  primary key (authority_id, version)
);
alter table public.authority_versions enable row level security;

create or replace function public.moon_authority_json(a public.authorities)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('id', a.id, 'kind', a.kind, 'label', a.label, 'variants', to_jsonb(a.variants),
    'sameAs', to_jsonb(a.same_as), 'note', a.note, 'data', a.data, 'createdBy', a.created_by,
    'createdAt', a.created_at, 'updatedAt', a.updated_at, 'mergedInto', a.merged_into, 'version', a.version)
$$;

-- Edits an entity. Returns { status: ok | conflict | duplicate | missing, authority?, other? }.
create or replace function public.moon_update_authority(
  p_id text, p_label text, p_variants text[], p_same_as text[], p_note text, p_data jsonb, p_by text,
  p_expected_version integer default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cur authorities;
  clash authorities;
  made authorities;
begin
  select * into cur from authorities where id = p_id for update;
  if cur.id is null or cur.merged_into is not null then
    return jsonb_build_object('status', 'missing');
  end if;
  if p_expected_version is not null and p_expected_version <> cur.version then
    return jsonb_build_object('status', 'conflict', 'authority', moon_authority_json(cur));
  end if;
  -- A new name another entity of this kind already has (as its name or another form) would make two
  -- entries for one thing: refused, so the cataloguer merges instead.
  if moon_normalize(p_label) <> cur.name_key then
    select * into clash from authorities
    where kind = cur.kind and merged_into is null and id <> cur.id
      and (name_key = moon_normalize(p_label)
           or moon_normalize(p_label) = any (select moon_normalize(v) from unnest(variants) v))
    limit 1;
    if clash.id is not null then
      return jsonb_build_object('status', 'duplicate', 'other', moon_authority_json(clash));
    end if;
  end if;
  insert into authority_versions (authority_id, version, label, variants, same_as, note, data, changed_by, changed_at)
  values (cur.id, cur.version, cur.label, cur.variants, cur.same_as, cur.note, cur.data, p_by, now())
  on conflict (authority_id, version) do nothing;
  update authorities set
    label      = btrim(p_label),
    variants   = array(select distinct btrim(v) from unnest(coalesce(p_variants, '{}')) v where btrim(v) <> '' and btrim(v) <> btrim(p_label)),
    same_as    = array(select distinct btrim(s) from unnest(coalesce(p_same_as, '{}')) s where btrim(s) ~ '^https?://'),
    note       = nullif(btrim(coalesce(p_note, '')), ''),
    data       = coalesce(p_data, '{}'::jsonb),
    version    = cur.version + 1,
    updated_at = now()
  where id = cur.id
  returning * into made;
  return jsonb_build_object('status', 'ok', 'authority', moon_authority_json(made));
end
$$;

-- Earlier states of an entity, newest first. changedBy is who replaced that state, and when.
create or replace function public.moon_authority_history(p_id text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'label', v.label, 'variants', to_jsonb(v.variants),
    'sameAs', to_jsonb(v.same_as), 'note', v.note, 'data', v.data, 'changedBy', v.changed_by, 'changedAt', v.changed_at)
    order by v.version desc), '[]'::jsonb)
  from authority_versions v where v.authority_id = p_id
$$;

-- Records (not deleted) whose document holds this address: how many, and up to 50 of them.
create or replace function public.moon_authority_usage(p_uri text)
returns jsonb
language sql
stable
set search_path = public
as $$
  with used as (
    select id, title, updated_at from records
    where deleted_at is null and strpos(document::text, '"' || p_uri || '"') > 0
  )
  select jsonb_build_object(
    'count', (select count(*) from used),
    'records', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title) order by updated_at desc)
                         from (select * from used order by updated_at desc limit 50) u), '[]'::jsonb))
$$;

revoke all on function public.moon_update_authority(text, text, text[], text[], text, jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.moon_authority_history(text) from public, anon, authenticated;
revoke all on function public.moon_authority_usage(text) from public, anon, authenticated;
revoke all on function public.moon_authority_json(public.authorities) from public, anon, authenticated;
