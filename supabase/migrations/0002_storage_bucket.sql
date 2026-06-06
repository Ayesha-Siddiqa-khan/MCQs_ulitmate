-- =============================================================================
-- MCQ Mentor - storage bucket for uploaded materials.
-- File layout: <user_id>/<material_id>/<original_filename>
-- Only the owner can read/write their own folder.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  52428800,   -- 50 MB
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner-only access policies on storage.objects
drop policy if exists "materials read own"   on storage.objects;
drop policy if exists "materials insert own" on storage.objects;
drop policy if exists "materials update own" on storage.objects;
drop policy if exists "materials delete own" on storage.objects;

create policy "materials read own" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "materials insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "materials update own" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "materials delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
