alter table public.profiles
add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and is_admin = public.is_admin()
);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can view all contributions" on public.contributions;
create policy "Admins can view all contributions"
on public.contributions
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update contributions" on public.contributions;
create policy "Admins can update contributions"
on public.contributions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete contributions" on public.contributions;
create policy "Admins can delete contributions"
on public.contributions
for delete
to authenticated
using (public.is_admin());
