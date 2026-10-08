-- Align the database loyalty award rate with the application constant.
--
-- Bug: the app awarded POINTS_EARNED_PER_CURRENCY (2) points per 1.00 spent for
-- ecommerce orders (lib/services/loyalty.ts), while this trigger function
-- awarded floor(total_amount) = 1 point per 1.00 for POS sales. The same basket
-- therefore earned a different number of points depending on the channel, and
-- the redemption tiers in lib/loyalty/tiers.ts only make sense against one
-- scale. The application constant is the intended rate, so the function is
-- brought in line with it.
--
-- Safe to re-run.

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
  -- Keep in sync with POINTS_EARNED_PER_CURRENCY in lib/loyalty/tiers.ts.
  v_points_per_currency constant integer := 2;
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

  v_points := floor(
    greatest(coalesce(v_order.total_amount, 0), 0) * v_points_per_currency
  )::integer;

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
