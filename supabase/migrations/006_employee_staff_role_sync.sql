-- Keep staff login accounts visible in the Employees screen.
-- This migration is intentionally non-destructive: it links or creates missing
-- employee rows for staff profiles, but it does not delete existing employees.

update public.employees e
set profile_id = p.id
from public.profiles p
join public.user_roles ur on ur.profile_id = p.id
where e.profile_id is null
  and e.email is not null
  and lower(e.email::text) = lower(p.email::text)
  and ur.role in ('admin', 'manager', 'clerk', 'cashier');

insert into public.employees (
  profile_id,
  full_name,
  email,
  phone,
  role,
  status,
  pay_type,
  salary_amount,
  hourly_rate,
  work_days,
  start_date,
  notes
)
select
  p.id,
  p.full_name,
  p.email,
  p.phone,
  case
    when bool_or(ur.role = 'admin') then 'admin'
    when bool_or(ur.role = 'manager') then 'manager'
    when bool_or(ur.role = 'clerk') then 'inventory'
    else 'cashier'
  end,
  'active',
  'salary',
  0,
  0,
  array[]::text[],
  current_date,
  'Created automatically from staff account roles.'
from public.profiles p
join public.user_roles ur on ur.profile_id = p.id
where ur.role in ('admin', 'manager', 'clerk', 'cashier')
  and not exists (
    select 1
    from public.employees e
    where e.profile_id = p.id
      or lower(coalesce(e.email::text, '')) = lower(p.email::text)
  )
group by p.id, p.full_name, p.email, p.phone
on conflict do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'idx_employees_profile_id_unique'
  )
  and not exists (
    select 1
    from public.employees
    where profile_id is not null
    group by profile_id
    having count(*) > 1
  ) then
    create unique index idx_employees_profile_id_unique
      on public.employees (profile_id)
      where profile_id is not null;
  end if;
end $$;
