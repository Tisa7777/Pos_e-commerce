create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email citext,
  phone text,
  role text not null default 'cashier'
    check (role in ('admin', 'manager', 'cashier', 'inventory', 'support')),
  status text not null default 'active'
    check (status in ('active', 'on_leave', 'inactive')),
  pay_type text not null default 'salary'
    check (pay_type in ('salary', 'hourly', 'commission')),
  salary_amount numeric(12, 2) not null default 0 check (salary_amount >= 0),
  hourly_rate numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  work_days text[] not null default '{}',
  shift_start time,
  shift_end time,
  start_date date,
  emergency_contact text,
  address text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.employees is
  'HR-style staff records for roles, pay settings, schedules, and store team management.';

create index if not exists idx_employees_profile_id on public.employees (profile_id);
create unique index if not exists idx_employees_profile_id_unique
  on public.employees (profile_id)
  where profile_id is not null;
create index if not exists idx_employees_role_status on public.employees (role, status);
create index if not exists idx_employees_email on public.employees (email);

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row execute procedure public.set_updated_at();
