-- Records and their version history, replacing the one-JSON-blob-per-record rows in kv_store_49c0e13c.
-- Only the edge function (service role) reads and writes these tables: RLS is on and there are no
-- policies, so the public anon key sees nothing.

create table if not exists public.records (
  id              text primary key check (id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  title           text not null default 'Untitled',
  -- Review workflow: testers' saves wait as pending-review; the Super Admin publishes (complete)
  -- or returns them (needs-review).
  status          text not null default 'pending-review'
                  check (status in ('pending-review', 'needs-review', 'complete')),
  cataloger       text,
  -- The current JSON-LD document (@graph with a bf:Work and a bf:Instance).
  document        jsonb not null check (coalesce(jsonb_typeof(document -> '@graph'), '') = 'array'),
  metadata        jsonb not null default '{}'::jsonb,
  -- Number of the latest row in record_versions; a save must name it to avoid overwriting.
  current_version integer not null default 1 check (current_version >= 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  approved_by     text,
  approved_at     timestamptz,
  reviewed_by     text,
  reviewed_at     timestamptz,
  -- Deleted records are kept with a date so they can be restored.
  deleted_at      timestamptz
);

create index if not exists records_status_idx     on public.records (status) where deleted_at is null;
create index if not exists records_cataloger_idx  on public.records (cataloger) where deleted_at is null;
create index if not exists records_updated_at_idx on public.records (updated_at desc);

-- Every save, in order. Version 1 of a migrated record is its state in the key-value store.
create table if not exists public.record_versions (
  record_id text not null references public.records (id) on delete cascade,
  version   integer not null check (version >= 1),
  title     text not null,
  status    text not null,
  document  jsonb not null,
  metadata  jsonb not null default '{}'::jsonb,
  saved_by  text,
  saved_at  timestamptz not null default now(),
  -- Why this version exists: 'save', 'approve', 'return', 'revert', 'migrated from kv_store'.
  note      text,
  primary key (record_id, version)
);

alter table public.records         enable row level security;
alter table public.record_versions enable row level security;
