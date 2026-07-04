-- =========================================================
-- POS cashier shift open/close reconciliation
-- =========================================================

create table if not exists public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_profile_id uuid references public.profiles (id) on delete set null,
  opened_by_profile_id uuid references public.profiles (id) on delete set null,
  closed_by_profile_id uuid references public.profiles (id) on delete set null,
  cashier_name text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_cash numeric(12, 2) not null default 0 check (opening_cash >= 0),
  closing_cash numeric(12, 2) check (closing_cash is null or closing_cash >= 0),
  expected_cash numeric(12, 2),
  cash_difference numeric(12, 2),
  cash_sales_amount numeric(12, 2) not null default 0,
  card_sales_amount numeric(12, 2) not null default 0,
  qr_sales_amount numeric(12, 2) not null default 0,
  total_sales_amount numeric(12, 2) not null default 0,
  order_count integer not null default 0,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.pos_shifts is
  'Cash drawer shifts for POS cashier reconciliation. Sales attach through orders.pos_shift_id.';

alter table public.orders
  add column if not exists pos_shift_id uuid references public.pos_shifts (id) on delete set null;

create index if not exists idx_pos_shifts_status_opened_at
  on public.pos_shifts (status, opened_at desc);
create index if not exists idx_pos_shifts_cashier_profile_status
  on public.pos_shifts (cashier_profile_id, status);
create index if not exists idx_orders_pos_shift_id
  on public.orders (pos_shift_id);

create trigger set_pos_shifts_updated_at
before update on public.pos_shifts
for each row execute function public.set_updated_at();

alter table public.pos_shifts enable row level security;

create policy "Staff read POS shifts"
on public.pos_shifts
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Cashiers manage POS shifts"
on public.pos_shifts
for all
to authenticated
using (public.has_role('cashier'))
with check (public.has_role('cashier'));
