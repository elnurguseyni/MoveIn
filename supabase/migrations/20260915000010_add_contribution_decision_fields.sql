alter table public.contributions
add column if not exists budget_range text,
add column if not exists key_takeaway text;

alter table public.contributions
drop constraint if exists contributions_budget_range_check;

alter table public.contributions
add constraint contributions_budget_range_check
check (budget_range is null or budget_range in ('Under €400', '€400–700', '€700+'));

create index if not exists contributions_city_budget_idx
on public.contributions (city, budget_range);
