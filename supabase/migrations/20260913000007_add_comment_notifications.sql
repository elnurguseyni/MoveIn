create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  type text not null default 'comment',
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view their notifications"
on public.notifications for select
to authenticated using (user_id = auth.uid());

create policy "Users can mark their notifications read"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.notify_post_owner_of_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
  post_title text;
begin
  select created_by, title into post_owner, post_title
  from public.contributions
  where id = new.contribution_id;

  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (user_id, contribution_id, comment_id, message)
    values (post_owner, new.contribution_id, new.id, 'Someone commented on your post: ' || post_title);
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_created on public.post_comments;
create trigger on_comment_created
after insert on public.post_comments
for each row execute procedure public.notify_post_owner_of_comment();

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
