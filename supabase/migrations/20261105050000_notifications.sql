-- In-app notifications. The app writes each message in the reader's language from these fields:
-- welcome (once per account, created the first time they open notifications), review (a record or edit
-- waits for the Super Admin), approved, returned (with the reviewer's reason).
create table if not exists public.notifications (
  id           bigserial primary key,
  username     text not null,
  kind         text not null check (kind in ('welcome', 'review', 'approved', 'returned')),
  record_id    text,
  record_title text,
  actor        text,
  reason       text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists notifications_user_idx on public.notifications (username, created_at desc);
alter table public.notifications enable row level security;

create or replace function public.moon_notify(p_user text, p_kind text, p_record_id text, p_record_title text, p_actor text, p_reason text default null)
returns void
language sql
set search_path = public
as $$
  insert into notifications (username, kind, record_id, record_title, actor, reason)
  values (p_user, p_kind, p_record_id, p_record_title, p_actor, nullif(btrim(coalesce(p_reason, '')), ''));
$$;

-- The newest notifications for a user and how many are unread. Gives a new user their welcome first.
create or replace function public.moon_notifications(p_user text, p_limit integer default 30)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from notifications where username = p_user and kind = 'welcome') then
    insert into notifications (username, kind) values (p_user, 'welcome');
  end if;
  return jsonb_build_object(
    'unread', (select count(*) from notifications where username = p_user and read_at is null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'recordId', record_id, 'recordTitle', record_title,
               'actor', actor, 'reason', reason, 'createdAt', created_at, 'read', read_at is not null) order by created_at desc, id desc)
      from (select * from notifications where username = p_user order by created_at desc, id desc
            limit greatest(1, least(coalesce(p_limit, 30), 100))) n
    ), '[]'::jsonb));
end
$$;

-- Marks the given notifications (or, with null, all of them) read for that user only.
create or replace function public.moon_notifications_read(p_user text, p_ids bigint[] default null)
returns integer
language sql
set search_path = public
as $$
  with done as (
    update notifications set read_at = now()
    where username = p_user and read_at is null and (p_ids is null or id = any(p_ids))
    returning 1
  )
  select count(*)::int from done;
$$;

revoke all on function public.moon_notify(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.moon_notifications(text, integer) from public, anon, authenticated;
revoke all on function public.moon_notifications_read(text, bigint[]) from public, anon, authenticated;
