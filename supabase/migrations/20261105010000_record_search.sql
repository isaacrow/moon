-- Server-side search. Each record (and each version, for the published catalogue) gets a normalized
-- search text, its language and its template, kept up to date by Postgres itself (generated columns).
-- moon_search_records answers one page of results with totals and filter counts.

-- Folds the spellings people type interchangeably, so a search finds a record however it was written:
-- Arabic diacritics and tatweel removed; أ إ آ ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي; Latin romanization
-- marks dropped (ā → a, ḥ → h, ʻ and ʼ removed); lower case; runs of spaces collapsed.
create or replace function public.moon_normalize(t text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(regexp_replace(
    translate(
      regexp_replace(lower(coalesce(t, '')),
        '[' || chr(1611) || '-' || chr(1618) || chr(1648) || chr(1600) || ']', '', 'g'),
      'أإآٱىةؤئāīūēōḥṣḍṭẓḳġṯḏšḫʻʼ’ʿʾ''',
      'اااايهويaiueohsdtzkgtdsh'),
    '\s+', ' ', 'g'))
$$;

-- Every text value in a JSON-LD document (labels, titles, notes…), without ids, types, context or web
-- addresses (older records keep some links, e.g. a language's id.loc.gov URI, as plain strings).
create or replace function public.moon_jsonb_text(j jsonb)
returns text
language sql
immutable
parallel safe
as $$
  select case jsonb_typeof(j)
    when 'string' then case when (j #>> '{}') ~* '^\s*https?://' then null else j #>> '{}' end
    when 'array' then (select string_agg(public.moon_jsonb_text(e), ' ') from jsonb_array_elements(j) e)
    when 'object' then (select string_agg(public.moon_jsonb_text(v), ' ')
                        from jsonb_each(j) as x(k, v) where k not in ('@id', '@type', '@context'))
  end
$$;

-- The Work's language code (e.g. ara, eng), from its first bf:language.
create or replace function public.moon_record_language(doc jsonb)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(coalesce(l ->> '@id', l #>> '{}'), '^.*/', '')
  from jsonb_array_elements(case jsonb_typeof(doc -> '@graph') when 'array' then doc -> '@graph' else '[]'::jsonb end) n,
       lateral (select case jsonb_typeof(n -> 'bf:language') when 'array' then n -> 'bf:language' -> 0 else n -> 'bf:language' end) x(l)
  where l is not null and (n -> '@type')::text ilike '%Work%'
  limit 1
$$;

alter table public.records
  add column if not exists search_text text
    generated always as (public.moon_normalize(title || ' ' || coalesce(cataloger, '') || ' ' || coalesce(public.moon_jsonb_text(document), ''))) stored,
  add column if not exists language_code text
    generated always as (public.moon_record_language(document)) stored,
  add column if not exists template_id text
    generated always as (metadata ->> 'templateId') stored;

alter table public.record_versions
  add column if not exists search_text text
    generated always as (public.moon_normalize(title || ' ' || coalesce(public.moon_jsonb_text(document), ''))) stored,
  add column if not exists language_code text
    generated always as (public.moon_record_language(document)) stored,
  add column if not exists template_id text
    generated always as (metadata ->> 'templateId') stored;

-- The published view gains the published version's search fields (columns can only be added at the end).
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
       r.current_version,
       public.moon_normalize(v.title || ' ' || coalesce(r.cataloger, '') || ' ' || coalesce(public.moon_jsonb_text(v.document), '')) as search_text,
       v.language_code,
       v.template_id
from public.records r
join public.record_versions v on v.record_id = r.id and v.version = r.published_version
where r.deleted_at is null;

revoke all on public.published_records from public, anon, authenticated;

-- One page of matching records, newest first (titles that contain the whole query come first), plus the
-- total and how many matches fall under each status, cataloger, language and template.
-- Every word of the query must appear (in any order). p_published searches the public catalogue.
create or replace function public.moon_search_records(
  p_query     text default '',
  p_published boolean default false,
  p_status    text default null,
  p_cataloger text default null,
  p_language  text default null,
  p_template  text default null,
  p_limit     integer default 50,
  p_offset    integer default 0
) returns jsonb
language sql
stable
set search_path = public
as $$
  with base as (
    select id, title, status, cataloger, document, metadata, created_at, updated_at,
           current_version as version, published_version, search_text, language_code, template_id
    from records where deleted_at is null and not p_published
    union all
    select id, title, 'complete', cataloger, document, metadata, created_at, updated_at,
           published_version, published_version, search_text, language_code, template_id
    from published_records where p_published
  ),
  q as (
    select moon_normalize(p_query) as whole,
           array_remove(regexp_split_to_array(moon_normalize(p_query), ' '), '') as words
  ),
  matched as (
    select b.*, (q.whole <> '' and moon_normalize(b.title) like '%' || q.whole || '%') as title_hit
    from base b, q
    where not exists (
      select 1 from unnest(q.words) w
      where position(w in b.search_text) = 0
    )
  ),
  filtered as (
    select * from matched
    where (p_status is null or status = p_status)
      and (p_cataloger is null or cataloger = p_cataloger)
      and (p_language is null or language_code = p_language)
      and (p_template is null or template_id = p_template)
  ),
  page as (
    select * from filtered
    order by title_hit desc, updated_at desc, id
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'status', status, 'cataloger', cataloger, 'document', document,
        'metadata', metadata, 'createdAt', created_at, 'saved', updated_at, 'version', version,
        'publishedVersion', published_version, 'language', language_code, 'template', template_id)
      order by title_hit desc, updated_at desc, id) from page), '[]'::jsonb),
    'facets', jsonb_build_object(
      'status',    coalesce((select jsonb_object_agg(k, n) from (select status k, count(*) n from matched group by 1) s), '{}'::jsonb),
      'cataloger', coalesce((select jsonb_object_agg(k, n) from (select cataloger k, count(*) n from matched where cataloger is not null group by 1) s), '{}'::jsonb),
      'language',  coalesce((select jsonb_object_agg(k, n) from (select language_code k, count(*) n from matched where language_code is not null group by 1) s), '{}'::jsonb),
      'template',  coalesce((select jsonb_object_agg(k, n) from (select template_id k, count(*) n from matched where template_id is not null group by 1) s), '{}'::jsonb)
    )
  )
$$;

revoke all on function public.moon_search_records(text, boolean, text, text, text, text, integer, integer) from public, anon, authenticated;
