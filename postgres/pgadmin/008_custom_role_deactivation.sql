-- Allow custom roles to be removed from the app without dropping enum values.

alter table public.app_roles
add column if not exists is_active boolean not null default true;

update public.app_roles
set is_active = true,
    updated_at = timezone('utc', now())
where is_system = true;
