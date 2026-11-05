-- Hubs (bf:Hub) join the local authority file: a hub collects the works and expressions of one creative
-- work (a title, or a creator and title, like a MARC uniform title). Its name is the authorized access
-- point (bflc:aap); sameAs points to an LC hub when one exists. Address: https://mooon.site/resource/hub/<id>.
alter table public.authorities drop constraint if exists authorities_kind_check;
alter table public.authorities add constraint authorities_kind_check
  check (kind in ('agent', 'place', 'topic', 'hub'));
