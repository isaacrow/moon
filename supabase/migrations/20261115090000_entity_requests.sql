-- Phase 13 S18, step 3: merging and splitting entities goes through an approval inbox. Any cataloger may ask
-- to merge one entity into another ("these are the same person") or to split a merged one again ("these are
-- two people"), with a reason; the Super Admin approves or declines. An approved merge keeps a snapshot of
-- the kept entity as it was, so a split later takes back exactly what the merge added.

create table if not exists public.entity_requests (
  id          bigserial primary key,
  kind        text not null check (kind in ('merge', 'split')),
  from_id     text not null references public.authorities (id) on delete cascade,
  into_id     text not null references public.authorities (id) on delete cascade,
  reason      text not null check (length(btrim(reason)) between 1 and 1000),
  asked_by    text not null,
  asked_at    timestamptz not null default now(),
  status      text not null default 'open' check (status in ('open', 'approved', 'declined')),
  decided_by  text,
  decided_at  timestamptz,
  note        text check (note is null or length(note) <= 500),
  -- The kept entity's name forms and links just before an approved merge.
  snapshot    jsonb,
  check (from_id <> into_id)
);
create unique index if not exists entity_requests_one_open on public.entity_requests (kind, from_id, into_id) where status = 'open';
alter table public.entity_requests enable row level security;

create or replace function public.moon_entity_request_json(r public.entity_requests)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('id', r.id, 'kind', r.kind, 'from', r.from_id, 'into', r.into_id, 'reason', r.reason,
    'askedBy', r.asked_by, 'askedAt', r.asked_at, 'status', r.status, 'decidedBy', r.decided_by, 'decidedAt', r.decided_at,
    'note', r.note,
    'fromLabel', (select label from authorities where id = r.from_id),
    'intoLabel', (select label from authorities where id = r.into_id),
    'entityKind', (select kind from authorities where id = r.into_id))
$$;

-- Asks for a merge (both exist, unmerged, same kind) or a split (from is merged into into). Null when the
-- request does not fit; an open request for the same pair is returned instead of a second one.
create or replace function public.moon_request_entity_change(p_kind text, p_from text, p_into text, p_reason text, p_by text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  a authorities;
  b authorities;
  r entity_requests;
begin
  select * into a from authorities where id = p_from;
  select * into b from authorities where id = p_into;
  if a.id is null or b.id is null or a.id = b.id or a.kind <> b.kind then return null; end if;
  if p_kind = 'merge' and (a.merged_into is not null or b.merged_into is not null) then return null; end if;
  if p_kind = 'split' and a.merged_into is distinct from b.id then return null; end if;
  select * into r from entity_requests where kind = p_kind and from_id = p_from and into_id = p_into and status = 'open';
  if r.id is null then
    insert into entity_requests (kind, from_id, into_id, reason, asked_by) values (p_kind, p_from, p_into, btrim(p_reason), p_by)
    returning * into r;
  end if;
  return moon_entity_request_json(r);
end
$$;

-- Undoes a merge: from stops forwarding, and the kept entity loses the name forms and links the merge added
-- (those it did not have before, from the merge's snapshot). Without a snapshot (a merge from before the
-- inbox) only from's name is taken back from the other forms, and its links stay.
create or replace function public.moon_split_authority(p_from text, p_into text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  a authorities;
  b authorities;
  snap jsonb;
  added_names text[];
  added_links text[];
begin
  select * into a from authorities where id = p_from;
  select * into b from authorities where id = p_into;
  if a.id is null or b.id is null or a.merged_into is distinct from b.id then return false; end if;
  select snapshot into snap from entity_requests
  where kind = 'merge' and from_id = p_from and into_id = p_into and status = 'approved' and snapshot is not null
  order by decided_at desc limit 1;
  if snap is not null then
    added_names := array(select v from unnest(a.variants || array[a.label]) v
                         where not v = any (array(select jsonb_array_elements_text(snap -> 'variants'))));
    added_links := array(select s from unnest(a.same_as) s
                         where not s = any (array(select jsonb_array_elements_text(snap -> 'sameAs'))));
  else
    added_names := array[a.label];
    added_links := '{}';
  end if;
  update authorities set
    variants = array(select v from unnest(b.variants) v where not v = any (added_names)),
    same_as = array(select s from unnest(b.same_as) s where not s = any (added_links)),
    updated_at = now()
  where id = b.id;
  update authorities set merged_into = null, updated_at = now() where id = a.id;
  return true;
end
$$;

-- Approves (carries it out) or declines an open request. Returns the request, or null when there is no open
-- one with this id; an approved request whose change no longer fits (an entity changed meanwhile) is
-- declined with a note instead.
create or replace function public.moon_decide_entity_request(p_id bigint, p_by text, p_approve boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r entity_requests;
  b authorities;
  done boolean;
begin
  select * into r from entity_requests where id = p_id and status = 'open' for update;
  if r.id is null then return null; end if;
  if not p_approve then
    update entity_requests set status = 'declined', decided_by = p_by, decided_at = now() where id = r.id returning * into r;
    return moon_entity_request_json(r);
  end if;
  if r.kind = 'merge' then
    select * into b from authorities where id = r.into_id;
    update entity_requests set snapshot = jsonb_build_object('variants', to_jsonb(b.variants), 'sameAs', to_jsonb(b.same_as)) where id = r.id;
    done := moon_merge_authority(r.from_id, r.into_id);
  else
    done := moon_split_authority(r.from_id, r.into_id);
  end if;
  update entity_requests
  set status = case when done then 'approved' else 'declined' end, decided_by = p_by, decided_at = now(),
      note = case when done then null else 'The entities changed since it was asked; nothing was done.' end,
      snapshot = case when done then snapshot end
  where id = r.id returning * into r;
  return moon_entity_request_json(r);
end
$$;

create or replace function public.moon_list_entity_requests(p_status text default 'open')
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(moon_entity_request_json(r) order by r.asked_at desc), '[]'::jsonb)
  from (select * from entity_requests where p_status is null or status = p_status order by asked_at desc limit 200) r
$$;

revoke all on function public.moon_entity_request_json(public.entity_requests) from public, anon, authenticated;
revoke all on function public.moon_request_entity_change(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.moon_split_authority(text, text) from public, anon, authenticated;
revoke all on function public.moon_decide_entity_request(bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.moon_list_entity_requests(text) from public, anon, authenticated;
