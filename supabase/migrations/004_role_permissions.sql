-- Role-based access control: configurable permissions per role.
-- Admin is intentionally NOT stored here; admins always have every permission.

create table if not exists public.role_permissions (
  role public.user_role not null,
  permission text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role, permission)
);

insert into public.role_permissions (role, permission) values
  ('cashier', 'pos'),
  ('clerk', 'products'),
  ('clerk', 'categories'),
  ('clerk', 'inventory'),
  ('manager', 'reports'),
  ('manager', 'comparison'),
  ('manager', 'orders')
on conflict do nothing;
