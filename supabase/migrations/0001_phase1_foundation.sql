-- JK SMART SCHOOLS ERP — Phase 1 foundation
-- Run in Supabase SQL Editor using a trusted project owner account.

create extension if not exists pgcrypto;

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null default 'Baramulla',
  region text not null default 'Jammu and Kashmir',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint zones_name_district_unique unique (name, district)
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete restrict,
  name text not null,
  udise_code text not null unique,
  school_category text,
  management_type text,
  district text not null default 'Baramulla',
  region text not null default 'Jammu and Kashmir',
  address text,
  email text,
  phone text,
  headmaster_name text,
  logo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'ur', 'ks')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'super_admin', 'zone_admin', 'school_admin', 'teacher', 'staff', 'parent', 'student'
  )),
  zone_id uuid references public.zones(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint user_roles_scope_check check (
    (role = 'super_admin' and zone_id is null and school_id is null)
    or (role = 'zone_admin' and zone_id is not null and school_id is null)
    or (role in ('school_admin', 'teacher', 'staff', 'student') and school_id is not null and zone_id is null)
    or (role = 'parent' and zone_id is null and school_id is null)
  )
);

create unique index if not exists user_roles_unique_scope
on public.user_roles (
  user_id, role, coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  school_id uuid references public.schools(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists schools_zone_id_idx on public.schools(zone_id);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists user_roles_school_id_idx on public.user_roles(school_id);
create index if not exists user_roles_zone_id_idx on public.user_roles(zone_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

-- Security-definer helpers avoid recursive RLS evaluation on user_roles.
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'super_admin'
  );
$$;

create or replace function public.is_zone_admin(p_zone_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'zone_admin'
      and ur.zone_id = p_zone_id
  );
$$;

create or replace function public.has_school_role(p_school_id uuid, p_roles text[] default null)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.schools s on s.id = p_school_id
      where ur.user_id = auth.uid()
        and (
          (ur.school_id = p_school_id and (p_roles is null or ur.role = any(p_roles)))
          or (ur.role = 'zone_admin' and ur.zone_id = s.zone_id and (p_roles is null or 'zone_admin' = any(p_roles)))
        )
    );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schools_touch_updated_at on public.schools;
create trigger schools_touch_updated_at
before update on public.schools
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Create a profile automatically for each newly authenticated account.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Audit school changes without storing sensitive row contents.
create or replace function public.audit_school_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_school_id := old.id;
    v_action := 'DELETE';
  elsif tg_op = 'INSERT' then
    v_school_id := new.id;
    v_action := 'INSERT';
  else
    v_school_id := new.id;
    v_action := 'UPDATE';
  end if;

  insert into public.audit_logs(actor_user_id, action, table_name, record_id, school_id, details)
  values (auth.uid(), v_action, 'schools', v_school_id::text, v_school_id,
          jsonb_build_object('school_name', case when tg_op = 'DELETE' then old.name else new.name end));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists schools_audit_trigger on public.schools;
create trigger schools_audit_trigger
after insert or update or delete on public.schools
for each row execute function public.audit_school_change();

-- Enable RLS on all application tables.
alter table public.zones enable row level security;
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

-- Zones: visible to super admins and members of the zone.
drop policy if exists zones_select_authorised on public.zones;
create policy zones_select_authorised on public.zones
for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.zone_id = zones.id
  )
  or exists (
    select 1 from public.schools s
    join public.user_roles ur on ur.school_id = s.id
    where s.zone_id = zones.id and ur.user_id = auth.uid()
  )
);

drop policy if exists zones_insert_super_admin on public.zones;
create policy zones_insert_super_admin on public.zones
for insert to authenticated
with check (public.is_super_admin());

drop policy if exists zones_update_super_admin on public.zones;
create policy zones_update_super_admin on public.zones
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Schools: scope by super admin, assigned zone, or assigned school.
drop policy if exists schools_select_authorised on public.schools;
create policy schools_select_authorised on public.schools
for select to authenticated
using (
  public.is_super_admin()
  or public.is_zone_admin(zone_id)
  or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.school_id = schools.id)
);

drop policy if exists schools_insert_authorised on public.schools;
create policy schools_insert_authorised on public.schools
for insert to authenticated
with check (public.is_super_admin() or public.is_zone_admin(zone_id));

drop policy if exists schools_update_authorised on public.schools;
create policy schools_update_authorised on public.schools
for update to authenticated
using (public.is_super_admin() or public.is_zone_admin(zone_id) or public.has_school_role(id, array['school_admin']))
with check (public.is_super_admin() or public.is_zone_admin(zone_id) or public.has_school_role(id, array['school_admin']));

-- Profiles: users see/edit their own profile; Super Admin can view all.
drop policy if exists profiles_select_self_or_super on public.profiles;
create policy profiles_select_self_or_super on public.profiles
for select to authenticated
using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Role records are not self-service. Users can see their own roles; Super Admin can manage all.
drop policy if exists roles_select_self_or_super on public.user_roles;
create policy roles_select_self_or_super on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists roles_manage_super_admin on public.user_roles;
create policy roles_manage_super_admin on public.user_roles
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Audit logs: Super Admin and relevant Zone Admins may view scoped logs.
drop policy if exists audit_select_authorised on public.audit_logs;
create policy audit_select_authorised on public.audit_logs
for select to authenticated
using (
  public.is_super_admin()
  or (school_id is not null and exists (
    select 1 from public.schools s
    join public.user_roles ur on ur.zone_id = s.zone_id
    where s.id = audit_logs.school_id and ur.user_id = auth.uid() and ur.role = 'zone_admin'
  ))
);

-- Initial administrative zone and first registered school.
insert into public.zones (name, district, region)
values ('Wagoora', 'Baramulla', 'Jammu and Kashmir')
on conflict (name, district) do nothing;

insert into public.schools (
  zone_id, name, udise_code, district, region, address, email, phone
)
select
  z.id,
  'Government Primary School Pethgam Wagoora',
  '01022202207',
  'Baramulla',
  'Jammu and Kashmir',
  'Wagoora Babareshi Road, Near Zonal Education Office Wagoora District Baramulla',
  'pspethgam@gmail.com',
  null
from public.zones z
where z.name = 'Wagoora' and z.district = 'Baramulla'
on conflict (udise_code) do nothing;

-- Restrict helper function execution to authenticated users.
revoke all on function public.is_super_admin() from public;
revoke all on function public.is_zone_admin(uuid) from public;
revoke all on function public.has_school_role(uuid, text[]) from public;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_zone_admin(uuid) to authenticated;
grant execute on function public.has_school_role(uuid, text[]) to authenticated;

-- Table grants; RLS still determines which rows are accessible.
grant select, insert, update on public.zones to authenticated;
grant select, insert, update on public.schools to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select on public.audit_logs to authenticated;
