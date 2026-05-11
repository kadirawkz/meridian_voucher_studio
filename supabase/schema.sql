create table if not exists public.employee_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_name text not null,
  email text not null,
  role text not null default 'employee' check (role in ('employee', 'manager', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_profiles_email_idx on public.employee_profiles (email);
create index if not exists employee_profiles_role_idx on public.employee_profiles (role);
create index if not exists employee_profiles_is_active_idx on public.employee_profiles (is_active);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_type text not null check (voucher_type in ('reservation', 'amendment', 'pptp')),
  tour_type text not null check (tour_type in ('SL', 'ASL', 'WSL', 'FSS', 'CSL', 'DSL', 'SLH')),
  status text not null default 'draft' check (status in ('draft', 'generated', 'sent')),
  created_by uuid references auth.users(id),
  voucher_date date,
  requisition_no text,
  tour_no text,
  tour_name text,
  hotel_name text,
  customer_name text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voucher_documents (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  format text not null check (format in ('docx', 'pdf')),
  docx_path text not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.voucher_revisions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  version_number integer not null,
  status text not null check (status in ('draft', 'generated', 'sent')),
  changed_by uuid not null references auth.users(id),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (voucher_id, version_number)
);

alter table public.vouchers
add column if not exists created_by uuid references auth.users(id);

alter table public.vouchers
add column if not exists voucher_date date,
add column if not exists requisition_no text,
add column if not exists tour_no text,
add column if not exists tour_name text,
add column if not exists hotel_name text,
add column if not exists customer_name text;

update public.vouchers
set
  voucher_date = nullif(payload->>'date', '')::date,
  requisition_no = payload->>'requisitionNo',
  tour_no = payload->>'tourNo',
  tour_name = payload->>'tourName',
  hotel_name = payload->>'hotelName',
  customer_name = payload->>'customerName'
where payload is not null
and (
  voucher_date is null
  or requisition_no is null
  or tour_no is null
  or tour_name is null
  or hotel_name is null
  or customer_name is null
);

-- If this migration is being applied to a database with existing rows, assign
-- created_by for those rows manually before making this column not null.
-- Example:
-- update public.vouchers set created_by = '<admin-user-id>' where created_by is null;
-- alter table public.vouchers alter column created_by set not null;

create index if not exists vouchers_voucher_type_idx on public.vouchers (voucher_type);
create index if not exists vouchers_tour_type_idx on public.vouchers (tour_type);
create index if not exists vouchers_created_at_idx on public.vouchers (created_at desc);
create index if not exists vouchers_created_by_idx on public.vouchers (created_by);
create index if not exists vouchers_voucher_date_idx on public.vouchers (voucher_date desc);
create index if not exists vouchers_requisition_no_idx on public.vouchers (requisition_no);
create index if not exists vouchers_tour_no_idx on public.vouchers (tour_no);
create index if not exists vouchers_hotel_name_idx on public.vouchers (hotel_name);
create index if not exists vouchers_customer_name_idx on public.vouchers (customer_name);
create index if not exists vouchers_payload_requisition_idx on public.vouchers ((payload->>'requisitionNo'));
create index if not exists voucher_documents_voucher_id_idx on public.voucher_documents (voucher_id);
create index if not exists voucher_documents_created_by_idx on public.voucher_documents (created_by);
create index if not exists voucher_documents_created_at_idx on public.voucher_documents (created_at desc);
create index if not exists voucher_documents_format_idx on public.voucher_documents (format);
create index if not exists voucher_revisions_voucher_id_idx on public.voucher_revisions (voucher_id);
create index if not exists voucher_revisions_changed_by_idx on public.voucher_revisions (changed_by);
create index if not exists voucher_revisions_created_at_idx on public.voucher_revisions (created_at desc);

create or replace function public.current_employee_is_active()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employee_profiles
    where id = auth.uid()
    and is_active = true
  );
$$;

revoke execute on function public.current_employee_is_active() from public;
revoke execute on function public.current_employee_is_active() from anon;
grant execute on function public.current_employee_is_active() to authenticated;

create or replace function public.current_employee_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.employee_profiles
  where id = auth.uid()
  and is_active = true;
$$;

revoke execute on function public.current_employee_role() from public;
revoke execute on function public.current_employee_role() from anon;
grant execute on function public.current_employee_role() to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    and p.proname = 'rls_auto_enable'
    and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon';
    execute 'revoke execute on function public.rls_auto_enable() from authenticated';
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vouchers_set_updated_at on public.vouchers;
drop trigger if exists employee_profiles_set_updated_at on public.employee_profiles;

create trigger vouchers_set_updated_at
before update on public.vouchers
for each row
execute function public.set_updated_at();

create trigger employee_profiles_set_updated_at
before update on public.employee_profiles
for each row
execute function public.set_updated_at();

alter table public.employee_profiles enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_documents enable row level security;
alter table public.voucher_revisions enable row level security;

drop policy if exists "Employees can read own profile" on public.employee_profiles;
drop policy if exists "Employees can insert own profile" on public.employee_profiles;
drop policy if exists "Employees can update own basic profile" on public.employee_profiles;
drop policy if exists "Admins can manage profiles" on public.employee_profiles;
drop policy if exists "Employees can read vouchers" on public.vouchers;
drop policy if exists "Employees can insert vouchers" on public.vouchers;
drop policy if exists "Employees can update vouchers" on public.vouchers;
drop policy if exists "Employees can read voucher documents" on public.voucher_documents;
drop policy if exists "Employees can insert voucher documents" on public.voucher_documents;
drop policy if exists "Employees can read voucher revisions" on public.voucher_revisions;
drop policy if exists "Employees can insert voucher revisions" on public.voucher_revisions;

create policy "Employees can read own profile"
on public.employee_profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_employee_role() in ('manager', 'admin')
);

create policy "Employees can insert own profile"
on public.employee_profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "Employees can update own basic profile"
on public.employee_profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = 'employee'
  and is_active = true
);

-- Ensure every auth user always has an employee profile row.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.employee_profiles (
    id,
    employee_name,
    email,
    role,
    is_active
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'employeeName', split_part(new.email, '@', 1)),
    new.email,
    'employee',
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    employee_name = coalesce(public.employee_profiles.employee_name, excluded.employee_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Backfill any existing auth users that don't yet have a profile.
insert into public.employee_profiles (id, employee_name, email, role, is_active)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'employeeName', split_part(u.email, '@', 1)) as employee_name,
  u.email,
  'employee',
  true
from auth.users u
left join public.employee_profiles p on p.id = u.id
where p.id is null;

create policy "Admins can manage profiles"
on public.employee_profiles
for all
to authenticated
using (public.current_employee_role() = 'admin')
with check (public.current_employee_role() = 'admin');

create policy "Employees can read vouchers"
on public.vouchers
for select
to authenticated
using (
  public.current_employee_is_active()
  and (
    created_by = auth.uid()
    or public.current_employee_role() in ('manager', 'admin')
  )
);

create policy "Employees can insert vouchers"
on public.vouchers
for insert
to authenticated
with check (
  public.current_employee_is_active()
  and created_by = auth.uid()
);

create policy "Employees can update vouchers"
on public.vouchers
for update
to authenticated
using (
  public.current_employee_is_active()
  and (
    created_by = auth.uid()
    or public.current_employee_role() in ('manager', 'admin')
  )
)
with check (
  public.current_employee_is_active()
  and (
    created_by = auth.uid()
    or public.current_employee_role() in ('manager', 'admin')
  )
);

create policy "Employees can read voucher documents"
on public.voucher_documents
for select
to authenticated
using (
  public.current_employee_is_active()
  and (
    created_by = auth.uid()
    or public.current_employee_role() in ('manager', 'admin')
  )
);

create policy "Employees can insert voucher documents"
on public.voucher_documents
for insert
to authenticated
with check (
  public.current_employee_is_active()
  and created_by = auth.uid()
);

create policy "Employees can read voucher revisions"
on public.voucher_revisions
for select
to authenticated
using (
  public.current_employee_is_active()
  and (
    changed_by = auth.uid()
    or public.current_employee_role() in ('manager', 'admin')
  )
);

create policy "Employees can insert voucher revisions"
on public.voucher_revisions
for insert
to authenticated
with check (
  public.current_employee_is_active()
  and changed_by = auth.uid()
);

-- ============================================================
-- Hotel Rates (ONE TABLE ONLY)
-- ============================================================

-- Remove legacy multi-table rate master (kept idempotent)
drop table if exists public.rate_master_guide_rules cascade;
drop table if exists public.rate_master_events cascade;
drop table if exists public.rate_master_surcharges cascade;
drop table if exists public.rate_master_supplements cascade;
drop table if exists public.rate_master_rates cascade;
drop table if exists public.rate_master_contracts cascade;

create table if not exists public.hotel_rates (
  id uuid primary key default gen_random_uuid(),
  hotel_name text not null,
  market text not null check (market in ('LOCAL', 'UK', 'GERMAN', 'CHINESE', 'INDIAN', 'FRANCE', 'VIKINER', 'ITALY', 'JAPAN', '')),
  currency text not null,
  contract_name text not null check (contract_name !~* 'premium|budget|luxury'),
  valid_from date not null,
  valid_to date not null,
  room_rates jsonb not null default '[]'::jsonb,
  seasonal_surcharges jsonb not null default '[]'::jsonb,
  compulsory_events jsonb not null default '[]'::jsonb,
  guide_rates jsonb not null default '{}'::jsonb,
  foc_rules jsonb not null default '{}'::jsonb,
  billing_instruction text not null default '',
  cancellation_policy jsonb not null default '{}'::jsonb,
  voucher_text_rules jsonb not null default '{}'::jsonb,
  skipped_sections text[] not null default '{}'::text[],
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_rates_hotel_idx on public.hotel_rates (hotel_name);
create index if not exists hotel_rates_market_idx on public.hotel_rates (market);
create index if not exists hotel_rates_contract_idx on public.hotel_rates (contract_name);
create index if not exists hotel_rates_validity_idx on public.hotel_rates (valid_from, valid_to);
create unique index if not exists hotel_rates_unique_record_idx
on public.hotel_rates (hotel_name, market, contract_name, valid_from, valid_to);

drop trigger if exists hotel_rates_set_updated_at on public.hotel_rates;
create trigger hotel_rates_set_updated_at
before update on public.hotel_rates
for each row execute function public.set_updated_at();

alter table public.hotel_rates enable row level security;

drop policy if exists "Employees can read hotel rates" on public.hotel_rates;
drop policy if exists "Employees can insert hotel rates" on public.hotel_rates;
drop policy if exists "Employees can update hotel rates" on public.hotel_rates;

create policy "Employees can read hotel rates"
on public.hotel_rates for select to authenticated
using (public.current_employee_is_active());

create policy "Employees can insert hotel rates"
on public.hotel_rates for insert to authenticated
with check (public.current_employee_is_active() and created_by = auth.uid());

create policy "Employees can update hotel rates"
on public.hotel_rates for update to authenticated
using (public.current_employee_is_active() and (created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin')))
with check (public.current_employee_is_active());
