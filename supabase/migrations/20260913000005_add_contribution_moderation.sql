alter table public.contributions
add column if not exists status text;

update public.contributions
set status = 'approved'
where status is null;

alter table public.contributions
alter column status set default 'pending',
alter column status set not null;

alter table public.contributions
drop constraint if exists contributions_status_check;

alter table public.contributions
add constraint contributions_status_check
check (status in ('pending', 'approved', 'hidden'));

create index if not exists contributions_status_idx
on public.contributions (status);
