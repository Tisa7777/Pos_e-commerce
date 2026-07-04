-- Custom RBAC role metadata.
-- The role value itself remains in public.user_role so existing role joins,
-- policies, and permission rows keep working.

create table if not exists public.app_roles (
  role public.user_role primary key,
  label text not null check (char_length(trim(label)) between 2 and 60),
  description text not null default '',
  kind text not null default 'editable' check (kind in ('full', 'none', 'editable')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_roles (role, label, description, kind, is_system, is_active) values
  ('admin', 'Owner', 'Full access to everything.', 'full', true, true),
  ('manager', 'Manager', 'Reports, analytics, and orders.', 'editable', true, true),
  ('clerk', 'Inventory Clerk', 'Products, categories, and stock.', 'editable', true, true),
  ('cashier', 'Cashier', 'POS register and sales.', 'editable', true, true),
  ('customer', 'Customer', 'Storefront only - no back-office access.', 'none', true, true)
on conflict (role) do update
  set label = excluded.label,
      description = excluded.description,
      kind = excluded.kind,
      is_system = true,
      is_active = true,
      updated_at = timezone('utc', now());

insert into public.app_roles (role, label, description, kind, is_system, is_active)
select
  role_value::public.user_role,
  initcap(replace(role_value::text, '_', ' ')),
  'Custom back-office role.',
  'editable',
  false,
  true
from unnest(enum_range(null::public.user_role)) as roles(role_value)
on conflict (role) do nothing;
