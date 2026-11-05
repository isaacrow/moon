-- Review v2: a record waiting for review can be assigned to a reviewer, who is notified.
alter table public.records add column if not exists assigned_to text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('welcome', 'review', 'approved', 'returned', 'comment', 'assigned'));

-- Assigns a record to a reviewer, or with null clears the assignment. Returns false for a missing record.
create or replace function public.moon_assign_record(p_id text, p_user text)
returns boolean
language sql
set search_path = public
as $$
  update records set assigned_to = nullif(btrim(coalesce(p_user, '')), '')
  where id = p_id and deleted_at is null
  returning true
$$;

revoke all on function public.moon_assign_record(text, text) from public, anon, authenticated;
