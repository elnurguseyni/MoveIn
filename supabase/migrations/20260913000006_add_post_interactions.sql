create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contribution_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create policy "Anyone can view post likes"
on public.post_likes for select
to anon, authenticated using (true);

create policy "Users can like posts"
on public.post_likes for insert
to authenticated with check (user_id = auth.uid());

create policy "Users can remove their likes"
on public.post_likes for delete
to authenticated using (user_id = auth.uid());

create policy "Anyone can view post comments"
on public.post_comments for select
to anon, authenticated using (true);

create policy "Users can create comments"
on public.post_comments for insert
to authenticated with check (user_id = auth.uid());

create policy "Users can delete their comments"
on public.post_comments for delete
to authenticated using (user_id = auth.uid() or public.is_admin());

create index if not exists post_likes_contribution_idx on public.post_likes (contribution_id);
create index if not exists post_comments_contribution_idx on public.post_comments (contribution_id, created_at desc);
