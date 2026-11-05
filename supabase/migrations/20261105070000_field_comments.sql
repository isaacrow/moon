-- Comments on a record's fields (review v2): a reviewer says what to fix on the exact field, the
-- cataloger replies there, either one resolves the thread. field is "<Entity>:<property>", e.g. "Instance:extent".
create table if not exists public.record_comments (
  id          bigserial primary key,
  record_id   text not null,
  field       text not null check (field ~ '^[A-Za-z]+:[A-Za-z0-9_.-]{1,80}$'),
  body        text not null check (length(btrim(body)) between 1 and 2000),
  author      text not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index if not exists record_comments_record_idx on public.record_comments (record_id, created_at);
alter table public.record_comments enable row level security;

-- Comments also notify: the cataloger when someone comments on their record, the Super Admin on a reply.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('welcome', 'review', 'approved', 'returned', 'comment'));

create or replace function public.moon_record_comments(p_record text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'field', field, 'body', body, 'author', author,
           'createdAt', created_at, 'resolvedAt', resolved_at, 'resolvedBy', resolved_by) order by created_at, id), '[]'::jsonb)
  from record_comments where record_id = p_record
$$;

create or replace function public.moon_add_comment(p_record text, p_field text, p_body text, p_author text)
returns jsonb
language sql
set search_path = public
as $$
  insert into record_comments (record_id, field, body, author) values (p_record, p_field, btrim(p_body), p_author)
  returning jsonb_build_object('id', id, 'field', field, 'body', body, 'author', author, 'createdAt', created_at,
                               'resolvedAt', resolved_at, 'resolvedBy', resolved_by)
$$;

-- Resolves (or reopens) a comment; resolving a field's comment resolves that field's whole thread.
create or replace function public.moon_resolve_comment(p_record text, p_id bigint, p_by text, p_resolved boolean default true)
returns integer
language sql
set search_path = public
as $$
  with target as (select field from record_comments where id = p_id and record_id = p_record),
  done as (
    update record_comments c
    set resolved_at = case when p_resolved then now() end, resolved_by = case when p_resolved then p_by end
    from target
    where c.record_id = p_record and c.field = target.field and (c.resolved_at is null) = p_resolved
    returning 1
  )
  select count(*)::int from done
$$;

revoke all on function public.moon_record_comments(text) from public, anon, authenticated;
revoke all on function public.moon_add_comment(text, text, text, text) from public, anon, authenticated;
revoke all on function public.moon_resolve_comment(text, bigint, text, boolean) from public, anon, authenticated;
