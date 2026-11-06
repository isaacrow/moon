-- How much of the backend's space Moon uses, for the Super Admin's dashboard: the database's size on disk
-- and the files kept in Storage (record covers, profile pictures), per bucket.
create or replace function public.moon_storage_usage()
returns jsonb
language sql
stable
security definer
set search_path = public, storage
as $$
  select jsonb_build_object(
    'databaseBytes', pg_database_size(current_database()),
    'storageBytes', coalesce((select sum(coalesce((metadata ->> 'size')::bigint, 0)) from storage.objects), 0),
    'storageFiles', (select count(*) from storage.objects),
    'buckets', coalesce((
      select jsonb_object_agg(bucket_id, jsonb_build_object('bytes', bytes, 'files', files))
      from (select bucket_id, sum(coalesce((metadata ->> 'size')::bigint, 0)) as bytes, count(*) as files
            from storage.objects group by bucket_id) b
    ), '{}'::jsonb),
    'records', (select count(*) from records where deleted_at is null)
  )
$$;

revoke all on function public.moon_storage_usage() from public, anon, authenticated;
