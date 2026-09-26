-- Run this once in Supabase Dashboard → SQL Editor.
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  tag text not null default 'Personal',
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  category text not null check (category in ('Everyday', 'Work', 'Adventure')),
  kind text not null check (kind in ('event', 'recording')),
  image text,
  duration double precision,
  mime_type text,
  size bigint,
  playback_start double precision,
  media_duration double precision
);

-- IDs are unique inside an account. Composite keys prevent one user's IDs from
-- conflicting with another user's data and upgrade earlier installations safely.
alter table public.notes drop constraint if exists notes_pkey;
alter table public.notes add primary key (user_id, id);
alter table public.memories drop constraint if exists memories_pkey;
alter table public.memories add primary key (user_id, id);

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists memories_user_id_idx on public.memories(user_id);
alter table public.notes enable row level security;
alter table public.memories enable row level security;

drop policy if exists "Users read their notes" on public.notes;
drop policy if exists "Users create their notes" on public.notes;
drop policy if exists "Users update their notes" on public.notes;
drop policy if exists "Users delete their notes" on public.notes;
create policy "Users read their notes" on public.notes for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create their notes" on public.notes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update their notes" on public.notes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete their notes" on public.notes for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users read their memories" on public.memories;
drop policy if exists "Users create their memories" on public.memories;
drop policy if exists "Users update their memories" on public.memories;
drop policy if exists "Users delete their memories" on public.memories;
create policy "Users read their memories" on public.memories for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create their memories" on public.memories for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update their memories" on public.memories for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete their memories" on public.memories for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('recordings', 'recordings', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Users read their recordings" on storage.objects;
drop policy if exists "Users upload their recordings" on storage.objects;
drop policy if exists "Users update their recordings" on storage.objects;
drop policy if exists "Users delete their recordings" on storage.objects;
create policy "Users read their recordings" on storage.objects for select to authenticated
using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users upload their recordings" on storage.objects for insert to authenticated
with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users update their recordings" on storage.objects for update to authenticated
using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users delete their recordings" on storage.objects for delete to authenticated
using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid()::text));
