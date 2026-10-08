-- Allow every built-in staff role to be assigned from Supabase Auth metadata.
-- This keeps Employee-created Inventory Clerk accounts from being created as
-- customer-only profiles by the auth trigger.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_role public.user_role;
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone;

  if new.raw_user_meta_data ? 'role' then
    begin
      v_requested_role := lower(new.raw_user_meta_data ->> 'role')::public.user_role;
    exception when invalid_text_representation then
      v_requested_role := null;
    end;
  end if;

  if v_requested_role in ('admin', 'cashier', 'clerk', 'manager') then
    insert into public.user_roles (profile_id, role)
    values (new.id, v_requested_role)
    on conflict (profile_id, role) do nothing;
  else
    insert into public.user_roles (profile_id, role)
    values (new.id, 'customer')
    on conflict (profile_id, role) do nothing;
  end if;

  if coalesce(v_requested_role, 'customer'::public.user_role) = 'customer' then
    insert into public.customers (profile_id, full_name, email, phone)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
      new.email,
      new.raw_user_meta_data ->> 'phone'
    )
    on conflict (profile_id) do update
      set full_name = excluded.full_name,
          email = excluded.email,
          phone = excluded.phone;
  end if;

  return new;
end;
$$;
