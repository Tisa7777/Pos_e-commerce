create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  transaction_type text not null,
  points_delta integer not null,
  balance_after integer,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint loyalty_transactions_type_check check (
    transaction_type in ('earned', 'redeemed', 'adjusted', 'reversed')
  ),
  constraint loyalty_transactions_points_nonzero check (points_delta <> 0)
);

create index if not exists idx_loyalty_transactions_customer_created_at
  on public.loyalty_transactions (customer_id, created_at desc);
create index if not exists idx_loyalty_transactions_order_id
  on public.loyalty_transactions (order_id);
create unique index if not exists uniq_loyalty_earned_order
  on public.loyalty_transactions (order_id)
  where transaction_type = 'earned' and order_id is not null;

drop trigger if exists set_loyalty_transactions_updated_at on public.loyalty_transactions;
create trigger set_loyalty_transactions_updated_at
before update on public.loyalty_transactions
for each row execute function public.set_updated_at();

create or replace function public.award_order_loyalty_points(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_points integer;
  v_transaction_id uuid;
  v_balance_after integer;
begin
  select
    o.id,
    o.customer_id,
    o.profile_id,
    o.cashier_profile_id,
    o.order_number,
    o.status,
    o.payment_status,
    o.total_amount,
    exists (
      select 1
      from public.payments p
      where p.order_id = o.id
        and p.status = 'paid'
    ) as has_paid_payment
  into v_order
  from public.orders o
  where o.id = p_order_id
  limit 1;

  if not found then
    return;
  end if;

  if v_order.customer_id is null then
    return;
  end if;

  if v_order.status in ('cancelled', 'refunded') then
    return;
  end if;

  if v_order.payment_status <> 'paid' and not v_order.has_paid_payment then
    return;
  end if;

  v_points := floor(greatest(coalesce(v_order.total_amount, 0), 0))::integer;

  if v_points <= 0 then
    return;
  end if;

  insert into public.loyalty_transactions (
    customer_id,
    order_id,
    created_by_profile_id,
    transaction_type,
    points_delta,
    description
  )
  values (
    v_order.customer_id,
    v_order.id,
    coalesce(v_order.cashier_profile_id, v_order.profile_id),
    'earned',
    v_points,
    'Earned from order ' || coalesce(v_order.order_number, v_order.id::text)
  )
  on conflict do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    return;
  end if;

  update public.customers
  set loyalty_points = loyalty_points + v_points
  where id = v_order.customer_id
  returning loyalty_points into v_balance_after;

  update public.loyalty_transactions
  set balance_after = v_balance_after
  where id = v_transaction_id;
end;
$$;

create or replace function public.award_order_loyalty_points_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'paid' then
    perform public.award_order_loyalty_points(new.order_id);
  elsif tg_op = 'UPDATE'
    and new.status = 'paid'
    and (
      old.status is distinct from new.status
      or old.order_id is distinct from new.order_id
    )
  then
    perform public.award_order_loyalty_points(new.order_id);
  end if;

  return new;
end;
$$;

create or replace function public.award_order_loyalty_points_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
    and new.status not in ('cancelled', 'refunded')
    and (
      old.payment_status is distinct from new.payment_status
      or old.status is distinct from new.status
      or old.customer_id is distinct from new.customer_id
      or old.total_amount is distinct from new.total_amount
    )
  then
    perform public.award_order_loyalty_points(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists award_loyalty_points_on_paid_payment on public.payments;
create trigger award_loyalty_points_on_paid_payment
after insert or update of status, order_id on public.payments
for each row execute function public.award_order_loyalty_points_from_payment();

drop trigger if exists award_loyalty_points_on_paid_order_update on public.orders;
create trigger award_loyalty_points_on_paid_order_update
after update of payment_status, status, customer_id, total_amount on public.orders
for each row execute function public.award_order_loyalty_points_from_order();
