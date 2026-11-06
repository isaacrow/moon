-- OPAC visitor counts for the dashboard. One row per day, visitor and page; a visitor is a daily key the
-- server makes from a hash (no address or browser is stored, and the key changes every day). Kept 400 days.

create table if not exists public.opac_visits (
  day date not null,
  visitor text not null,
  path text not null,
  kind text not null,
  ref text not null default '',
  views integer not null default 1,
  primary key (day, visitor, path)
);
create index if not exists opac_visits_day on public.opac_visits (day, kind);

alter table public.opac_visits enable row level security;
revoke all on public.opac_visits from public, anon, authenticated;

create or replace function public.moon_record_visit(p_day date, p_visitor text, p_kind text, p_ref text)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into opac_visits (day, visitor, path, kind, ref)
  values (p_day, left(p_visitor, 64), left(p_kind || '|' || coalesce(p_ref, ''), 260), p_kind, left(coalesce(p_ref, ''), 200))
  on conflict (day, visitor, path) do update set views = opac_visits.views + 1;
  if random() < 0.01 then
    delete from opac_visits where day < p_day - 400;
  end if;
end
$$;

-- Visitors and page views: today, the last 7 days, each of the last p_days days, and what was read most.
-- "visitors" over several days adds up each day's visitors (a returning visitor counts once a day).
create or replace function public.moon_visit_stats(p_today date, p_days integer default 30)
returns jsonb
language sql
stable
set search_path = public
as $$
  with n as (select greatest(1, least(coalesce(p_days, 30), 366)) as d),
  span as (select v.* from opac_visits v, n where v.day > p_today - n.d and v.day <= p_today),
  per_day as (select day, count(distinct visitor) as visitors, sum(views) as views from span group by day),
  top as (
    select kind, ref, count(distinct (day, visitor)) as visitors, sum(views) as views,
           row_number() over (partition by case when kind = 'work' then 'work' when kind = 'search' then 'search' else 'entity' end
                              order by count(distinct (day, visitor)) desc, sum(views) desc, ref) as rn
    from span where ref <> '' group by kind, ref
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
      'visitors', coalesce((select visitors from per_day where day = p_today), 0),
      'views', coalesce((select views from per_day where day = p_today), 0)),
    'week', jsonb_build_object(
      'visitors', coalesce((select sum(visitors) from per_day where day > p_today - 7), 0),
      'views', coalesce((select sum(views) from per_day where day > p_today - 7), 0)),
    'period', jsonb_build_object(
      'days', (select d from n),
      'visitors', coalesce((select sum(visitors) from per_day), 0),
      'views', coalesce((select sum(views) from per_day), 0)),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'visitors', coalesce(p.visitors, 0), 'views', coalesce(p.views, 0)) order by g.day), '[]'::jsonb)
             from n, lateral (select (p_today - i)::date as day from generate_series(0, n.d - 1) i) g
             left join per_day p on p.day = g.day),
    'topRecords', (select coalesce(jsonb_agg(jsonb_build_object('id', t.ref, 'title', coalesce(r.title, t.ref), 'visitors', t.visitors, 'views', t.views) order by t.rn), '[]'::jsonb)
                   from top t left join records r on r.id = t.ref where t.kind = 'work' and t.rn <= 10),
    'topSearches', (select coalesce(jsonb_agg(jsonb_build_object('query', t.ref, 'visitors', t.visitors, 'views', t.views) order by t.rn), '[]'::jsonb)
                    from top t where t.kind = 'search' and t.rn <= 10),
    'topEntities', (select coalesce(jsonb_agg(jsonb_build_object('kind', t.kind, 'key', t.ref, 'visitors', t.visitors, 'views', t.views) order by t.rn), '[]'::jsonb)
                    from top t where t.kind not in ('work', 'search') and t.rn <= 10)
  )
$$;

revoke all on function public.moon_record_visit(date, text, text, text) from public, anon, authenticated;
revoke all on function public.moon_visit_stats(date, integer) from public, anon, authenticated;
