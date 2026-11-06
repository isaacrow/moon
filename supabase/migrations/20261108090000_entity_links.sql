-- Phase 10, step 3: an entity is known by its outside links (LC, VIAF, Wikidata, ISNI, FAST, ORCID) as well
-- as by its name. Adding an entity that carries a link an existing entity of the same kind already has
-- returns that entity, however differently the two names are spelled ("Ibn Khaldūn, 1332-1406" and
-- "ابن خلدون" are one person when both link LC's n50052785). This applies to the Entities screen and to the
-- entities every record save creates.

-- One spelling of a link: no scheme, no www, no trailing slash, Wikidata's /wiki/ and /entity/ alike.
create or replace function public.moon_link_key(p text) returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(regexp_replace(lower(btrim(coalesce(p, ''))), '^https?://(www\.)?', ''), '/+$', ''),
           '^wikidata\.org/wiki/', 'wikidata.org/entity/')
$$;

create or replace function public.moon_link_keys(p text[]) returns text[]
language sql
immutable
as $$
  select coalesce(array(select distinct public.moon_link_key(s) from unnest(coalesce(p, '{}')) s where btrim(s) <> ''), '{}')
$$;

create index if not exists authorities_link_keys on public.authorities using gin (public.moon_link_keys(same_as));

-- The entity (not merged) that already has one of these links, oldest first; of one kind when a kind is given.
create or replace function public.moon_find_authority_by_links(p_links text[], p_kind text default null)
returns jsonb
language sql
stable
set search_path = public
as $$
  select moon_authority_json(a)
  from authorities a
  where a.merged_into is null
    and (p_kind is null or a.kind = p_kind)
    and moon_link_keys(a.same_as) && moon_link_keys(p_links)
  order by a.created_at
  limit 1
$$;

-- As before, plus: an entity of the same kind that shares an outside link is the same entity.
create or replace function public.moon_add_authority(
  p_id text, p_kind text, p_label text, p_variants text[], p_same_as text[], p_note text, p_data jsonb, p_by text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  found authorities;
  made authorities;
begin
  if coalesce(array_length(moon_link_keys(p_same_as), 1), 0) > 0 then
    select * into found from authorities
    where kind = p_kind and merged_into is null
      and moon_link_keys(same_as) && moon_link_keys(p_same_as)
    order by created_at
    limit 1;
  end if;
  if found.id is null then
    select * into found from authorities
    where kind = p_kind and merged_into is null
      and (name_key = moon_normalize(p_label)
           or moon_normalize(p_label) = any (select moon_normalize(v) from unnest(variants) v))
    order by created_at
    limit 1;
  end if;
  if found.id is not null then
    return jsonb_build_object('existing', true, 'authority', moon_authority_json(found));
  end if;
  insert into authorities (id, kind, label, variants, same_as, note, data, created_by)
  values (p_id, p_kind, btrim(p_label),
          array(select distinct btrim(v) from unnest(coalesce(p_variants, '{}')) v where btrim(v) <> '' and btrim(v) <> btrim(p_label)),
          array(select distinct btrim(s) from unnest(coalesce(p_same_as, '{}')) s where btrim(s) ~ '^https?://'),
          nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_data, '{}'::jsonb), p_by)
  returning * into made;
  return jsonb_build_object('existing', false, 'authority', moon_authority_json(made));
end
$$;
