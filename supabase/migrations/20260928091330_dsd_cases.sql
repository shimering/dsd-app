create table public.dsd_cases (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  body jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dsd_schema_version check ((body->'schemaVersion' = '2'::jsonb) is true),
  constraint dsd_case_identity check ((body->>'id' = id::text) is true),
  constraint dsd_owner_identity check ((body->>'ownerId' = owner_id::text) is true),
  constraint dsd_no_inline_media check (body::text !~ '(data:image/|data:video/|blob:)'),
  constraint dsd_photos_array check ((jsonb_typeof(body->'photos') = 'array') is true)
);
create index dsd_cases_owner_updated on public.dsd_cases(owner_id, updated_at desc);
alter table public.dsd_cases enable row level security;
revoke all on public.dsd_cases from public, anon, authenticated;
grant select, insert, update, delete on public.dsd_cases to authenticated;
create policy dsd_owner_select on public.dsd_cases for select to authenticated using ((select auth.uid()) = owner_id);
create policy dsd_owner_insert on public.dsd_cases for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy dsd_owner_update on public.dsd_cases for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy dsd_owner_delete on public.dsd_cases for delete to authenticated using ((select auth.uid()) = owner_id);
comment on table public.dsd_cases is 'Dentist-owned structured DSD records. Original/generated media stay in local IndexedDB; no Storage buckets.';
