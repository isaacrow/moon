-- Phase 13 S4: "suggest a change". Anyone signed in may suggest a new value for one field of a record,
-- with a reason; the record's cataloger (or the Super Admin) accepts it (the editor puts the value in the
-- field) or declines it, and the person who suggested it is told. A suggestion is a field comment that
-- carries the suggested value, so it sits in the same thread as the field's comments.

alter table public.record_comments add column if not exists suggested text
  check (suggested is null or length(suggested) between 1 and 4000);
alter table public.record_comments add column if not exists decision text
  check (decision is null or decision in ('accepted', 'declined'));
alter table public.record_comments add column if not exists decided_by text;
alter table public.record_comments add column if not exists decided_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('welcome', 'review', 'approved', 'returned', 'comment', 'assigned', 'suggestion', 'suggestion_accepted', 'suggestion_declined'));

create or replace function public.moon_comment_json(c public.record_comments)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('id', c.id, 'field', c.field, 'body', c.body, 'author', c.author, 'createdAt', c.created_at,
    'resolvedAt', c.resolved_at, 'resolvedBy', c.resolved_by, 'suggested', c.suggested, 'decision', c.decision,
    'decidedBy', c.decided_by, 'decidedAt', c.decided_at)
$$;

create or replace function public.moon_record_comments(p_record text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(moon_comment_json(c) order by c.created_at, c.id), '[]'::jsonb)
  from record_comments c where c.record_id = p_record
$$;

create or replace function public.moon_add_suggestion(p_record text, p_field text, p_body text, p_value text, p_author text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  made record_comments;
begin
  insert into record_comments (record_id, field, body, author, suggested)
  values (p_record, p_field, btrim(p_body), p_author, p_value)
  returning * into made;
  return moon_comment_json(made);
end
$$;

-- Accepts or declines one open suggestion; null when there is none to decide (already decided, or not a
-- suggestion). A decided suggestion is also resolved, so it no longer counts as open on the field.
create or replace function public.moon_decide_suggestion(p_record text, p_id bigint, p_by text, p_accept boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  done record_comments;
begin
  update record_comments
  set decision = case when p_accept then 'accepted' else 'declined' end, decided_by = p_by, decided_at = now(),
      resolved_at = coalesce(resolved_at, now()), resolved_by = coalesce(resolved_by, p_by)
  where id = p_id and record_id = p_record and suggested is not null and decision is null
  returning * into done;
  if done.id is null then
    return null;
  end if;
  return moon_comment_json(done);
end
$$;

revoke all on function public.moon_comment_json(public.record_comments) from public, anon, authenticated;
revoke all on function public.moon_record_comments(text) from public, anon, authenticated;
revoke all on function public.moon_add_suggestion(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.moon_decide_suggestion(text, bigint, text, boolean) from public, anon, authenticated;
