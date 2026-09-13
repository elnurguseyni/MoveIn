create or replace function public.notify_post_owner_of_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
  post_title text;
  commenter_name text;
  mentioned_user uuid;
begin
  select created_by, title into post_owner, post_title
  from public.contributions
  where id = new.contribution_id;

  select coalesce(display_name, 'Community member') into commenter_name
  from public.profiles
  where id = new.user_id;

  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (user_id, contribution_id, comment_id, message)
    values (
      post_owner,
      new.contribution_id,
      new.id,
      commenter_name || ' commented on your post: ' || post_title
    );
  end if;

  foreach mentioned_user in array new.mentioned_user_ids loop
    if mentioned_user <> new.user_id and mentioned_user <> post_owner then
      insert into public.notifications (user_id, contribution_id, comment_id, message)
      values (
        mentioned_user,
        new.contribution_id,
        new.id,
        commenter_name || ' tagged you in a comment on: ' || post_title
      );
    end if;
  end loop;

  return new;
end;
$$;
