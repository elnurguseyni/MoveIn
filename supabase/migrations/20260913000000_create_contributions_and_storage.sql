create extension if not exists pgcrypto;

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  title text not null,
  city text not null,
  category text not null,
  details text not null,
  source text not null default 'guide',
  rating text,
  quote text,
  meta text,
  media_url text,
  media_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contributions_created_at_idx
on public.contributions (created_at desc);

create index if not exists contributions_created_by_idx
on public.contributions (created_by);

alter table public.contributions enable row level security;

drop policy if exists "Anyone can view contributions" on public.contributions;
create policy "Anyone can view contributions"
on public.contributions
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can create contributions" on public.contributions;
create policy "Authenticated users can create contributions"
on public.contributions
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Users can update their own contributions" on public.contributions;
create policy "Users can update their own contributions"
on public.contributions
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "Users can delete their own contributions" on public.contributions;
create policy "Users can delete their own contributions"
on public.contributions
for delete
to authenticated
using (created_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users can upload community media" on storage.objects;
create policy "Authenticated users can upload community media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'user-posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Anyone can view community media" on storage.objects;
create policy "Anyone can view community media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'community-media');

drop policy if exists "Users can delete their own community media" on storage.objects;
create policy "Users can delete their own community media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'user-posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);
