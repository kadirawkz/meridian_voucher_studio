-- Meridian Voucher Studio — Strict 3NF Schema

-- 1. EMPLOYEE PROFILES
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

-- 2. REFERENCE TABLES
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default ''
);

create table if not exists public.room_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tour_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.meal_basis (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.currencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);


-- 3. HOTEL RATES (parent) — FK to hotels, markets
-- Drop old legacy tables
drop table if exists public.rate_master_guide_rules cascade;
drop table if exists public.rate_master_events cascade;
drop table if exists public.rate_master_surcharges cascade;
drop table if exists public.rate_master_supplements cascade;
drop table if exists public.rate_master_rates cascade;
drop table if exists public.rate_master_contracts cascade;

-- Drop existing 3NF tables to ensure schema changes are applied
-- (CREATE TABLE IF NOT EXISTS would silently skip tables with old columns)
drop table if exists public.voucher_revisions cascade;
drop table if exists public.voucher_documents cascade;
drop table if exists public.voucher_line_items cascade;
drop table if exists public.vouchers cascade;
drop table if exists public.hotel_rate_room_supplements cascade;
drop table if exists public.hotel_rate_guide_prices cascade;
drop table if exists public.hotel_rate_events cascade;
drop table if exists public.hotel_rate_surcharges cascade;
drop table if exists public.hotel_rate_child_prices cascade;
drop table if exists public.hotel_rate_room_prices cascade;
drop table if exists public.hotel_rates cascade;

create table if not exists public.hotel_rates (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id),
  market_id uuid references public.markets(id),
  currency text not null,
  contract_name text not null check (contract_name !~* 'premium|budget|luxury'),
  valid_from date not null,
  valid_to date not null,
  check (valid_to >= valid_from),
  billing_instruction text not null default '',
  foc_enabled boolean not null default false,
  foc_applies_to text not null default 'Guide',
  foc_minimum_persons integer not null default 0,
  foc_quantity integer not null default 1,
  foc_basis text not null default '',
  foc_count_adults boolean not null default true,
  foc_count_child_2_5 boolean not null default false,
  foc_count_child_6_11 boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_rates_hotel_idx on public.hotel_rates (hotel_id);
create index if not exists hotel_rates_market_idx on public.hotel_rates (market_id);
create index if not exists hotel_rates_validity_idx on public.hotel_rates (valid_from, valid_to);
create unique index if not exists hotel_rates_unique_record_idx
  on public.hotel_rates (hotel_id, market_id, contract_name, valid_from, valid_to);

-- 3a. Room Prices — FK to room_categories
create table if not exists public.hotel_rate_room_prices (
  id uuid primary key default gen_random_uuid(),
  hotel_rate_id uuid not null references public.hotel_rates(id) on delete cascade,
  valid_from date not null,
  valid_to date not null,
  check (valid_to >= valid_from),
  room_category_id uuid not null references public.room_categories(id),
  basis text not null,
  sgl numeric, dbl numeric, twn numeric, tpl numeric
);
create index if not exists hotel_rate_room_prices_rate_idx on public.hotel_rate_room_prices (hotel_rate_id);
create index if not exists hotel_rate_room_prices_cat_idx on public.hotel_rate_room_prices (room_category_id);

-- 3b. Child Prices — FK to room_categories
create table if not exists public.hotel_rate_child_prices (
  id uuid primary key default gen_random_uuid(),
  hotel_rate_id uuid not null references public.hotel_rates(id) on delete cascade,
  valid_from date not null,
  valid_to date not null,
  check (valid_to >= valid_from),
  room_category_id uuid not null references public.room_categories(id),
  basis text not null,
  age_2_5_sharing text, age_2_5_extra_bed text, age_2_5_own_room text,
  age_6_11_sharing text, age_6_11_extra_bed text, age_6_11_own_room text
);
create index if not exists hotel_rate_child_prices_rate_idx on public.hotel_rate_child_prices (hotel_rate_id);

-- 3c. Seasonal Surcharges
create table if not exists public.hotel_rate_surcharges (
  id uuid primary key default gen_random_uuid(),
  hotel_rate_id uuid not null references public.hotel_rates(id) on delete cascade,
  name text not null, amount numeric,
  date_from date, date_to date, applies_to text
);
create index if not exists hotel_rate_surcharges_rate_idx on public.hotel_rate_surcharges (hotel_rate_id);

-- 3d. Compulsory Events
create table if not exists public.hotel_rate_events (
  id uuid primary key default gen_random_uuid(),
  hotel_rate_id uuid not null references public.hotel_rates(id) on delete cascade,
  event_date date not null, event_name text not null,
  bb_rate numeric, hb_rate numeric, fb_rate numeric,
  per text not null default 'Person', mandatory boolean not null default true
);
create index if not exists hotel_rate_events_rate_idx on public.hotel_rate_events (hotel_rate_id);

-- 3e. Guide Prices
create table if not exists public.hotel_rate_guide_prices (
  id uuid primary key default gen_random_uuid(),
  hotel_rate_id uuid not null references public.hotel_rates(id) on delete cascade,
  basis text not null,
  rate numeric
);
create index if not exists hotel_rate_guide_prices_rate_idx on public.hotel_rate_guide_prices (hotel_rate_id);

-- 3f. Room Supplements — flat per-room-per-night uplifts for specific categories
create table if not exists public.hotel_rate_room_supplements (
  id uuid primary key default gen_random_uuid(),
  hotel_rate_id uuid not null references public.hotel_rates(id) on delete cascade,
  room_category_id uuid not null references public.room_categories(id),
  supplement_name text not null default '',
  supplement_amount numeric not null default 0,
  per text not null default 'per room per night'
);
create index if not exists hotel_rate_room_supplements_rate_idx on public.hotel_rate_room_supplements (hotel_rate_id);

-- 4. VOUCHERS — FK to hotels, markets, customers; no employee_name/email
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_type text not null check (voucher_type in ('reservation', 'amendment', 'pptp')),
  tour_type text not null,
  status text not null default 'draft' check (status in ('draft', 'generated', 'sent')),
  created_by uuid not null references auth.users(id),
  voucher_date date,
  page_number text not null default '1',
  voucher_title text not null default '',
  requisition_no text, tour_no text, tour_name text,
  hotel_id uuid references public.hotels(id),
  market_id uuid references public.markets(id),
  customer_id uuid references public.customers(id),
  rate_period text not null default '',
  confirmed_by text not null default '',
  rate_applicable numeric not null default 0,
  billing_instructions text not null default '',
  remarks text not null default '',
  matched_hotel_rate_id uuid references public.hotel_rates(id) on delete set null,
  rate_applicable_text text not null default '',
  guide_text text not null default '',
  surcharge_text text not null default '',
  event_supplement_text text not null default '',
  manually_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vouchers_created_at_idx on public.vouchers (created_at desc);
create index if not exists vouchers_created_by_idx on public.vouchers (created_by);
create index if not exists vouchers_voucher_date_idx on public.vouchers (voucher_date desc);
create index if not exists vouchers_requisition_no_idx on public.vouchers (requisition_no);
create index if not exists vouchers_tour_no_idx on public.vouchers (tour_no);
create index if not exists vouchers_hotel_id_idx on public.vouchers (hotel_id);
create index if not exists vouchers_customer_id_idx on public.vouchers (customer_id);

-- 4a. Voucher Line Items — FK to room_categories, CHECK counts
create table if not exists public.voucher_line_items (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  line_order integer not null,
  required_date date,
  room_category_id uuid references public.room_categories(id),
  basis text not null default '',
  single_rooms integer not null default 0 check (single_rooms >= 0),
  double_rooms integer not null default 0 check (double_rooms >= 0),
  twin_rooms integer not null default 0 check (twin_rooms >= 0),
  triple_rooms integer not null default 0 check (triple_rooms >= 0),
  child_2_5 integer not null default 0 check (child_2_5 >= 0),
  child_6_11 integer not null default 0 check (child_6_11 >= 0),
  guide_count integer not null default 0 check (guide_count >= 0),
  guide_basis text not null default '',
  arriving_for text not null default '',
  unique (voucher_id, line_order)
);
create index if not exists voucher_line_items_voucher_idx on public.voucher_line_items (voucher_id);

-- 5. VOUCHER DOCUMENTS
create table if not exists public.voucher_documents (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  format text not null check (format in ('docx', 'pdf')),
  docx_path text not null, pdf_path text,
  created_at timestamptz not null default now()
);
create index if not exists voucher_documents_voucher_id_idx on public.voucher_documents (voucher_id);
create index if not exists voucher_documents_created_at_idx on public.voucher_documents (created_at desc);

-- 6. VOUCHER REVISIONS (delta-based)
create table if not exists public.voucher_revisions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  version_number integer not null,
  status text not null check (status in ('draft', 'generated', 'sent')),
  changed_by uuid not null references auth.users(id),
  changed_fields jsonb not null default '{}'::jsonb,
  snapshot_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (voucher_id, version_number)
);
create index if not exists voucher_revisions_voucher_id_idx on public.voucher_revisions (voucher_id);

-- FUNCTIONS
create or replace function public.current_employee_is_active()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.employee_profiles where id = auth.uid() and is_active = true);
$$;
revoke execute on function public.current_employee_is_active() from public;
revoke execute on function public.current_employee_is_active() from anon;
grant execute on function public.current_employee_is_active() to authenticated;

create or replace function public.current_employee_role()
returns text language sql security definer set search_path = public as $$
  select role from public.employee_profiles where id = auth.uid() and is_active = true;
$$;
revoke execute on function public.current_employee_role() from public;
revoke execute on function public.current_employee_role() from anon;
grant execute on function public.current_employee_role() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists vouchers_set_updated_at on public.vouchers;
drop trigger if exists employee_profiles_set_updated_at on public.employee_profiles;
drop trigger if exists hotel_rates_set_updated_at on public.hotel_rates;
create trigger vouchers_set_updated_at before update on public.vouchers for each row execute function public.set_updated_at();
create trigger employee_profiles_set_updated_at before update on public.employee_profiles for each row execute function public.set_updated_at();
create trigger hotel_rates_set_updated_at before update on public.hotel_rates for each row execute function public.set_updated_at();

-- ROW LEVEL SECURITY
alter table public.employee_profiles enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_line_items enable row level security;
alter table public.voucher_documents enable row level security;
alter table public.voucher_revisions enable row level security;
alter table public.hotel_rates enable row level security;
alter table public.hotel_rate_room_prices enable row level security;
alter table public.hotel_rate_child_prices enable row level security;
alter table public.hotel_rate_surcharges enable row level security;
alter table public.hotel_rate_events enable row level security;
alter table public.hotel_rate_guide_prices enable row level security;
alter table public.hotel_rate_room_supplements enable row level security;
alter table public.hotels enable row level security;
alter table public.markets enable row level security;
alter table public.room_categories enable row level security;
alter table public.customers enable row level security;
alter table public.tour_types enable row level security;
alter table public.meal_basis enable row level security;
alter table public.currencies enable row level security;

-- Employee Profiles RLS
drop policy if exists "Employees can read own profile" on public.employee_profiles;
drop policy if exists "Employees can insert own profile" on public.employee_profiles;
drop policy if exists "Employees can update own basic profile" on public.employee_profiles;
drop policy if exists "Admins can manage profiles" on public.employee_profiles;
create policy "Employees can read own profile" on public.employee_profiles for select to authenticated
  using (id = auth.uid() or public.current_employee_role() in ('manager', 'admin'));
create policy "Employees can insert own profile" on public.employee_profiles for insert to authenticated
  with check (id = auth.uid());
create policy "Employees can update own basic profile" on public.employee_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = 'employee' and is_active = true);
create policy "Admins can manage profiles" on public.employee_profiles for all to authenticated
  using (public.current_employee_role() = 'admin') with check (public.current_employee_role() = 'admin');

-- Reference Tables RLS (read for all, write for active employees)
drop policy if exists "Anyone can read hotels" on public.hotels;
drop policy if exists "Employees can manage hotels" on public.hotels;
drop policy if exists "Anyone can read markets" on public.markets;
drop policy if exists "Employees can manage markets" on public.markets;
drop policy if exists "Anyone can read room categories" on public.room_categories;
drop policy if exists "Employees can manage room categories" on public.room_categories;
drop policy if exists "Anyone can read customers" on public.customers;
drop policy if exists "Employees can manage customers" on public.customers;

create policy "Anyone can read hotels" on public.hotels for select to authenticated using (true);
create policy "Employees can manage hotels" on public.hotels for all to authenticated
  using (public.current_employee_is_active()) with check (public.current_employee_is_active());
create policy "Anyone can read markets" on public.markets for select to authenticated using (true);
create policy "Employees can manage markets" on public.markets for all to authenticated
  using (public.current_employee_is_active()) with check (public.current_employee_is_active());
create policy "Anyone can read room categories" on public.room_categories for select to authenticated using (true);
create policy "Employees can manage room categories" on public.room_categories for all to authenticated
  using (public.current_employee_is_active()) with check (public.current_employee_is_active());
create policy "Anyone can read customers" on public.customers for select to authenticated using (true);
create policy "Employees can manage customers" on public.customers for all to authenticated
  using (public.current_employee_is_active()) with check (public.current_employee_is_active());

drop policy if exists "Anyone can read tour types" on public.tour_types;
drop policy if exists "Employees can manage tour types" on public.tour_types;
drop policy if exists "Anyone can read meal basis" on public.meal_basis;
drop policy if exists "Employees can manage meal basis" on public.meal_basis;
drop policy if exists "Anyone can read currencies" on public.currencies;
drop policy if exists "Employees can manage currencies" on public.currencies;

create policy "Anyone can read tour types" on public.tour_types for select to authenticated using (true);
create policy "Employees can manage tour types" on public.tour_types for all to authenticated
  using (public.current_employee_is_active()) with check (public.current_employee_is_active());

create policy "Anyone can read meal basis" on public.meal_basis for select to authenticated using (true);
create policy "Employees can manage meal basis" on public.meal_basis for all to authenticated
  using (public.current_employee_is_active()) with check (public.current_employee_is_active());

create policy "Anyone can read currencies" on public.currencies for select to authenticated using (true);
create policy "Employees can manage currencies" on public.currencies for all to authenticated
  using (public.current_employee_is_active()) with check (public.current_employee_is_active());

-- Vouchers RLS
drop policy if exists "Employees can read vouchers" on public.vouchers;
drop policy if exists "Employees can insert vouchers" on public.vouchers;
drop policy if exists "Employees can update vouchers" on public.vouchers;
create policy "Employees can read vouchers" on public.vouchers for select to authenticated
  using (public.current_employee_is_active() and (created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin')));
create policy "Employees can insert vouchers" on public.vouchers for insert to authenticated
  with check (public.current_employee_is_active() and created_by = auth.uid());
create policy "Employees can update vouchers" on public.vouchers for update to authenticated
  using (public.current_employee_is_active() and (created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin')))
  with check (public.current_employee_is_active() and (created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin')));

-- Voucher Line Items RLS (inherit from parent voucher)
drop policy if exists "Employees can read voucher line items" on public.voucher_line_items;
drop policy if exists "Employees can insert voucher line items" on public.voucher_line_items;
drop policy if exists "Employees can update voucher line items" on public.voucher_line_items;
drop policy if exists "Employees can delete voucher line items" on public.voucher_line_items;
create policy "Employees can read voucher line items" on public.voucher_line_items for select to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.vouchers v where v.id = voucher_id and (v.created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin'))));
create policy "Employees can insert voucher line items" on public.voucher_line_items for insert to authenticated
  with check (public.current_employee_is_active() and exists (select 1 from public.vouchers v where v.id = voucher_id and (v.created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin'))));
create policy "Employees can update voucher line items" on public.voucher_line_items for update to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.vouchers v where v.id = voucher_id and (v.created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin'))));
create policy "Employees can delete voucher line items" on public.voucher_line_items for delete to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.vouchers v where v.id = voucher_id and (v.created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin'))));

-- Voucher Documents RLS
drop policy if exists "Employees can read voucher documents" on public.voucher_documents;
drop policy if exists "Employees can insert voucher documents" on public.voucher_documents;
create policy "Employees can read voucher documents" on public.voucher_documents for select to authenticated
  using (public.current_employee_is_active() and (created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin')));
create policy "Employees can insert voucher documents" on public.voucher_documents for insert to authenticated
  with check (public.current_employee_is_active() and created_by = auth.uid());

-- Voucher Revisions RLS
drop policy if exists "Employees can read voucher revisions" on public.voucher_revisions;
drop policy if exists "Employees can insert voucher revisions" on public.voucher_revisions;
create policy "Employees can read voucher revisions" on public.voucher_revisions for select to authenticated
  using (public.current_employee_is_active() and (changed_by = auth.uid() or public.current_employee_role() in ('manager', 'admin')));
create policy "Employees can insert voucher revisions" on public.voucher_revisions for insert to authenticated
  with check (public.current_employee_is_active() and changed_by = auth.uid());

-- Hotel Rates RLS
drop policy if exists "Employees can read hotel rates" on public.hotel_rates;
drop policy if exists "Employees can insert hotel rates" on public.hotel_rates;
drop policy if exists "Employees can update hotel rates" on public.hotel_rates;
drop policy if exists "Employees can delete hotel rates" on public.hotel_rates;
create policy "Employees can read hotel rates" on public.hotel_rates for select to authenticated using (public.current_employee_is_active());
create policy "Employees can insert hotel rates" on public.hotel_rates for insert to authenticated with check (public.current_employee_is_active() and created_by = auth.uid());
create policy "Employees can update hotel rates" on public.hotel_rates for update to authenticated
  using (public.current_employee_is_active() and (created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin'))) with check (public.current_employee_is_active());
create policy "Employees can delete hotel rates" on public.hotel_rates for delete to authenticated
  using (public.current_employee_is_active() and (created_by = auth.uid() or public.current_employee_role() in ('manager', 'admin')));

-- Hotel Rate Child Tables RLS (inherit ownership from parent hotel_rates)
drop policy if exists "Employees can read hotel rate room prices" on public.hotel_rate_room_prices;
drop policy if exists "Employees can manage hotel rate room prices" on public.hotel_rate_room_prices;
drop policy if exists "Employees can read hotel rate child prices" on public.hotel_rate_child_prices;
drop policy if exists "Employees can manage hotel rate child prices" on public.hotel_rate_child_prices;
drop policy if exists "Employees can read hotel rate surcharges" on public.hotel_rate_surcharges;
drop policy if exists "Employees can manage hotel rate surcharges" on public.hotel_rate_surcharges;
drop policy if exists "Employees can read hotel rate events" on public.hotel_rate_events;
drop policy if exists "Employees can manage hotel rate events" on public.hotel_rate_events;
drop policy if exists "Employees can read hotel rate guide prices" on public.hotel_rate_guide_prices;
drop policy if exists "Employees can manage hotel rate guide prices" on public.hotel_rate_guide_prices;

create policy "Employees can read hotel rate room prices" on public.hotel_rate_room_prices for select to authenticated using (public.current_employee_is_active());
create policy "Employees can manage hotel rate room prices" on public.hotel_rate_room_prices for all to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))))
  with check (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))));

create policy "Employees can read hotel rate child prices" on public.hotel_rate_child_prices for select to authenticated using (public.current_employee_is_active());
create policy "Employees can manage hotel rate child prices" on public.hotel_rate_child_prices for all to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))))
  with check (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))));

create policy "Employees can read hotel rate surcharges" on public.hotel_rate_surcharges for select to authenticated using (public.current_employee_is_active());
create policy "Employees can manage hotel rate surcharges" on public.hotel_rate_surcharges for all to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))))
  with check (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))));

create policy "Employees can read hotel rate events" on public.hotel_rate_events for select to authenticated using (public.current_employee_is_active());
create policy "Employees can manage hotel rate events" on public.hotel_rate_events for all to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))))
  with check (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))));

create policy "Employees can read hotel rate guide prices" on public.hotel_rate_guide_prices for select to authenticated using (public.current_employee_is_active());
create policy "Employees can manage hotel rate guide prices" on public.hotel_rate_guide_prices for all to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))))
  with check (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))));

drop policy if exists "Employees can read hotel rate room supplements" on public.hotel_rate_room_supplements;
drop policy if exists "Employees can manage hotel rate room supplements" on public.hotel_rate_room_supplements;
create policy "Employees can read hotel rate room supplements" on public.hotel_rate_room_supplements for select to authenticated using (public.current_employee_is_active());
create policy "Employees can manage hotel rate room supplements" on public.hotel_rate_room_supplements for all to authenticated
  using (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))))
  with check (public.current_employee_is_active() and exists (select 1 from public.hotel_rates hr where hr.id = hotel_rate_id and (hr.created_by = auth.uid() or public.current_employee_role() in ('manager','admin'))));
-- AUTO-CREATE EMPLOYEE PROFILE ON AUTH SIGN-UP
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.employee_profiles (id, employee_name, email, role, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'employeeName', split_part(new.email, '@', 1)), new.email, 'employee', true)
  on conflict (id) do update set email = excluded.email, employee_name = coalesce(public.employee_profiles.employee_name, excluded.employee_name);
  return new;
end; $$;
revoke execute on function public.handle_new_auth_user() from public;
revoke execute on function public.handle_new_auth_user() from anon;
revoke execute on function public.handle_new_auth_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

insert into public.employee_profiles (id, employee_name, email, role, is_active)
select u.id, coalesce(u.raw_user_meta_data->>'employeeName', split_part(u.email, '@', 1)), u.email, 'employee', true
from auth.users u left join public.employee_profiles p on p.id = u.id where p.id is null;
