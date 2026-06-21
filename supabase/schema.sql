-- Meridian Voucher Studio — Strict 3NF Schema

-- =============================================================================
-- 1. EMPLOYEE PROFILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.employee_profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    email         TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_profiles_email_idx ON public.employee_profiles (email);
CREATE INDEX IF NOT EXISTS employee_profiles_role_idx ON public.employee_profiles (role);


-- =============================================================================
-- 2. REFERENCE TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.hotels (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    email      TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.markets (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code      TEXT NOT NULL UNIQUE,
    name      TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.room_categories (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name      TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tour_types (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meal_basis (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.currencies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure the is_active column exists on all reference tables (in case they already exist in the DB)
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.room_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tour_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.meal_basis ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.currencies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.hotel_rates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;


-- =============================================================================
-- 3. DROP LEGACY TABLES & PREVIOUS 3NF TABLES (For Fresh Migration Deployments)
-- =============================================================================

-- Drop old legacy tables
DROP TABLE IF EXISTS public.rate_master_guide_rules CASCADE;
DROP TABLE IF EXISTS public.rate_master_events CASCADE;
DROP TABLE IF EXISTS public.rate_master_surcharges CASCADE;
DROP TABLE IF EXISTS public.rate_master_supplements CASCADE;
DROP TABLE IF EXISTS public.rate_master_rates CASCADE;
DROP TABLE IF EXISTS public.rate_master_contracts CASCADE;

-- COMMENTED OUT TO PREVENT DATA LOSS DURING RUNTIME SCHEMA EXECUTION
-- Drop existing 3NF tables to ensure schema changes are applied
-- DROP TABLE IF EXISTS public.voucher_revisions CASCADE;
-- DROP TABLE IF EXISTS public.voucher_documents CASCADE;
-- DROP TABLE IF EXISTS public.voucher_line_items CASCADE;
-- DROP TABLE IF EXISTS public.vouchers CASCADE;
-- DROP TABLE IF EXISTS public.hotel_rate_room_supplements CASCADE;
-- DROP TABLE IF EXISTS public.hotel_rate_guide_prices CASCADE;
-- DROP TABLE IF EXISTS public.hotel_rate_events CASCADE;
-- DROP TABLE IF EXISTS public.hotel_rate_surcharges CASCADE;
-- DROP TABLE IF EXISTS public.hotel_rate_child_prices CASCADE;
-- DROP TABLE IF EXISTS public.hotel_rate_room_prices CASCADE;
-- DROP TABLE IF EXISTS public.hotel_rates CASCADE;


-- =============================================================================
-- 4. HOTEL RATES & CHILD RELATIONSHIPS
-- =============================================================================

-- Hotel Rates (Parent)
CREATE TABLE IF NOT EXISTS public.hotel_rates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id            UUID NOT NULL REFERENCES public.hotels(id),
    market_id           UUID REFERENCES public.markets(id),
    currency            TEXT NOT NULL,
    contract_name       TEXT NOT NULL CHECK (contract_name !~* 'premium|budget|luxury'),
    valid_from          DATE NOT NULL,
    valid_to            DATE NOT NULL,
    CHECK (valid_to >= valid_from),
    billing_instruction TEXT NOT NULL DEFAULT '',
    foc_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    foc_applies_to      TEXT NOT NULL DEFAULT 'Guide',
    foc_minimum_persons INTEGER NOT NULL DEFAULT 0,
    foc_quantity        INTEGER NOT NULL DEFAULT 1,
    foc_basis           TEXT NOT NULL DEFAULT '',
    foc_count_adults    BOOLEAN NOT NULL DEFAULT TRUE,
    foc_count_child_2_5_99 BOOLEAN NOT NULL DEFAULT FALSE,
    foc_count_child_6_11_99 BOOLEAN NOT NULL DEFAULT FALSE,
    foc_pax_custom_text TEXT NOT NULL DEFAULT '',
    foc_guide_custom_text TEXT NOT NULL DEFAULT '',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hotel_rates_hotel_idx ON public.hotel_rates (hotel_id);
CREATE INDEX IF NOT EXISTS hotel_rates_market_idx ON public.hotel_rates (market_id);
CREATE INDEX IF NOT EXISTS hotel_rates_validity_idx ON public.hotel_rates (valid_from, valid_to);
CREATE UNIQUE INDEX IF NOT EXISTS hotel_rates_unique_record_idx
    ON public.hotel_rates (hotel_id, market_id, contract_name, valid_from, valid_to);

-- Room Prices (Child)
CREATE TABLE IF NOT EXISTS public.hotel_rate_room_prices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_rate_id    UUID NOT NULL REFERENCES public.hotel_rates(id) ON DELETE CASCADE,
    valid_from       DATE NOT NULL,
    valid_to         DATE NOT NULL,
    CHECK (valid_to >= valid_from),
    room_category_id UUID NOT NULL REFERENCES public.room_categories(id),
    basis            TEXT NOT NULL,
    sgl              NUMERIC,
    dbl              NUMERIC,
    twn              NUMERIC,
    tpl              NUMERIC
);

CREATE INDEX IF NOT EXISTS hotel_rate_room_prices_rate_idx ON public.hotel_rate_room_prices (hotel_rate_id);
CREATE INDEX IF NOT EXISTS hotel_rate_room_prices_cat_idx ON public.hotel_rate_room_prices (room_category_id);

-- Child Prices (Child)
CREATE TABLE IF NOT EXISTS public.hotel_rate_child_prices (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_rate_id          UUID NOT NULL REFERENCES public.hotel_rates(id) ON DELETE CASCADE,
    valid_from             DATE NOT NULL,
    valid_to               DATE NOT NULL,
    CHECK (valid_to >= valid_from),
    room_category_id       UUID NOT NULL REFERENCES public.room_categories(id),
    basis                  TEXT NOT NULL,
    age_2_5_99_sharing     TEXT,
    age_2_5_99_extra_bed   TEXT,
    age_2_5_99_own_room    TEXT,
    age_6_11_99_sharing    TEXT,
    age_6_11_99_extra_bed  TEXT,
    age_6_11_99_own_room   TEXT
);

CREATE INDEX IF NOT EXISTS hotel_rate_child_prices_rate_idx ON public.hotel_rate_child_prices (hotel_rate_id);

-- Seasonal Surcharges (Child)
CREATE TABLE IF NOT EXISTS public.hotel_rate_surcharges (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_rate_id UUID NOT NULL REFERENCES public.hotel_rates(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    amount        NUMERIC,
    date_from     DATE,
    date_to       DATE,
    applies_to    TEXT NOT NULL DEFAULT 'All'
);

CREATE INDEX IF NOT EXISTS hotel_rate_surcharges_rate_idx ON public.hotel_rate_surcharges (hotel_rate_id);

-- Compulsory Events (Child)
CREATE TABLE IF NOT EXISTS public.hotel_rate_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_rate_id UUID NOT NULL REFERENCES public.hotel_rates(id) ON DELETE CASCADE,
    event_date    DATE NOT NULL,
    event_name    TEXT NOT NULL,
    bb_rate       NUMERIC,
    hb_rate       NUMERIC,
    fb_rate       NUMERIC,
    per           TEXT NOT NULL DEFAULT 'Person',
    mandatory     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS hotel_rate_events_rate_idx ON public.hotel_rate_events (hotel_rate_id);

-- Guide Prices (Child)
CREATE TABLE IF NOT EXISTS public.hotel_rate_guide_prices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_rate_id UUID NOT NULL REFERENCES public.hotel_rates(id) ON DELETE CASCADE,
    basis         TEXT NOT NULL,
    rate          NUMERIC
);

CREATE INDEX IF NOT EXISTS hotel_rate_guide_prices_rate_idx ON public.hotel_rate_guide_prices (hotel_rate_id);

-- Room Supplements (Child)
CREATE TABLE IF NOT EXISTS public.hotel_rate_room_supplements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_rate_id     UUID NOT NULL REFERENCES public.hotel_rates(id) ON DELETE CASCADE,
    room_category_id  UUID NOT NULL REFERENCES public.room_categories(id),
    supplement_name   TEXT NOT NULL DEFAULT '',
    supplement_amount NUMERIC NOT NULL DEFAULT 0,
    per               TEXT NOT NULL DEFAULT 'per room per night'
);

CREATE INDEX IF NOT EXISTS hotel_rate_room_supplements_rate_idx ON public.hotel_rate_room_supplements (hotel_rate_id);


-- =============================================================================
-- 5. VOUCHERS & RELATED DOCUMENTS
-- =============================================================================

-- Vouchers
CREATE TABLE IF NOT EXISTS public.vouchers (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_type           TEXT NOT NULL CHECK (voucher_type IN ('reservation', 'amendment', 'pptp')),
    tour_type              TEXT NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent')),
    created_by             UUID NOT NULL REFERENCES auth.users(id),
    voucher_date           DATE,
    page_number            TEXT NOT NULL DEFAULT '1',
    voucher_title          TEXT NOT NULL DEFAULT '',
    requisition_no         TEXT,
    tour_no                TEXT,
    tour_name              TEXT,
    hotel_id               UUID REFERENCES public.hotels(id),
    market_id              UUID REFERENCES public.markets(id),
    customer_id            UUID REFERENCES public.customers(id),
    rate_period            TEXT NOT NULL DEFAULT '',
    confirmed_by           TEXT NOT NULL DEFAULT '',
    rate_applicable        NUMERIC NOT NULL DEFAULT 0,
    billing_instructions   TEXT NOT NULL DEFAULT '',
    remarks                TEXT NOT NULL DEFAULT '',
    matched_hotel_rate_id  UUID REFERENCES public.hotel_rates(id) ON DELETE SET NULL,
    rate_applicable_text   TEXT NOT NULL DEFAULT '',
    guide_text             TEXT NOT NULL DEFAULT '',
    surcharge_text         TEXT NOT NULL DEFAULT '',
    event_supplement_text  TEXT NOT NULL DEFAULT '',
    manually_edited        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vouchers_created_at_idx ON public.vouchers (created_at DESC);
CREATE INDEX IF NOT EXISTS vouchers_created_by_idx ON public.vouchers (created_by);
CREATE INDEX IF NOT EXISTS vouchers_voucher_date_idx ON public.vouchers (voucher_date DESC);
CREATE INDEX IF NOT EXISTS vouchers_requisition_no_idx ON public.vouchers (requisition_no);
CREATE INDEX IF NOT EXISTS vouchers_tour_no_idx ON public.vouchers (tour_no);
CREATE INDEX IF NOT EXISTS vouchers_hotel_id_idx ON public.vouchers (hotel_id);
CREATE INDEX IF NOT EXISTS vouchers_customer_id_idx ON public.vouchers (customer_id);

-- Voucher Line Items
CREATE TABLE IF NOT EXISTS public.voucher_line_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id              UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    line_order              INTEGER NOT NULL,
    required_date           DATE,
    room_category_id        UUID REFERENCES public.room_categories(id),
    basis                   TEXT NOT NULL DEFAULT '',
    single_rooms            INTEGER NOT NULL DEFAULT 0 CHECK (single_rooms >= 0),
    double_rooms            INTEGER NOT NULL DEFAULT 0 CHECK (double_rooms >= 0),
    twin_rooms              INTEGER NOT NULL DEFAULT 0 CHECK (twin_rooms >= 0),
    triple_rooms            INTEGER NOT NULL DEFAULT 0 CHECK (triple_rooms >= 0),
    child_2_5_99            INTEGER NOT NULL DEFAULT 0 CHECK (child_2_5_99 >= 0),
    child_6_11_99           INTEGER NOT NULL DEFAULT 0 CHECK (child_6_11_99 >= 0),
    child_2_5_99_sharing    INTEGER NOT NULL DEFAULT 0 CHECK (child_2_5_99_sharing >= 0),
    child_2_5_99_bed        INTEGER NOT NULL DEFAULT 0 CHECK (child_2_5_99_bed >= 0),
    child_2_5_99_own_room   INTEGER NOT NULL DEFAULT 0 CHECK (child_2_5_99_own_room >= 0),
    child_6_11_99_sharing   INTEGER NOT NULL DEFAULT 0 CHECK (child_6_11_99_sharing >= 0),
    child_6_11_99_bed       INTEGER NOT NULL DEFAULT 0 CHECK (child_6_11_99_bed >= 0),
    child_6_11_99_own_room  INTEGER NOT NULL DEFAULT 0 CHECK (child_6_11_99_own_room >= 0),
    supplementary           TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    guide_count             INTEGER NOT NULL DEFAULT 0 CHECK (guide_count >= 0),
    guide_basis             TEXT NOT NULL DEFAULT '',
    arriving_for            TEXT NOT NULL DEFAULT '',
    UNIQUE (voucher_id, line_order)
);

CREATE INDEX IF NOT EXISTS voucher_line_items_voucher_idx ON public.voucher_line_items (voucher_id);

-- Voucher Documents
CREATE TABLE IF NOT EXISTS public.voucher_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id  UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES auth.users(id),
    format      TEXT NOT NULL CHECK (format IN ('docx', 'pdf')),
    docx_path   TEXT NOT NULL,
    pdf_path    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voucher_documents_voucher_id_idx ON public.voucher_documents (voucher_id);
CREATE INDEX IF NOT EXISTS voucher_documents_created_at_idx ON public.voucher_documents (created_at DESC);

-- Voucher Revisions
CREATE TABLE IF NOT EXISTS public.voucher_revisions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id     UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('draft', 'generated', 'sent')),
    changed_by     UUID NOT NULL REFERENCES auth.users(id),
    changed_fields JSONB NOT NULL DEFAULT '{}'::JSONB,
    snapshot_summary TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (voucher_id, version_number)
);

CREATE INDEX IF NOT EXISTS voucher_revisions_voucher_id_idx ON public.voucher_revisions (voucher_id);


-- =============================================================================
-- 6. SECURITY FUNCTIONS & HELPER FUNCTIONS
-- =============================================================================

-- Drop the dependent event trigger first to avoid dependency blocks
DROP EVENT TRIGGER IF EXISTS ensure_rls;

CREATE SCHEMA IF NOT EXISTS internal;

-- Utility to automatically enable Row Level Security (RLS) on all newly created tables
CREATE OR REPLACE FUNCTION internal.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE classid = 'pg_class'::regclass LOOP
        IF obj.object_type = 'table' THEN
            EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', obj.object_identity);
        END IF;
    END LOOP;
END;
$$;

-- Lock down execution privileges completely on the utility function
REVOKE ALL ON FUNCTION internal.rls_auto_enable() FROM public, anon, authenticated;

-- Drop old vulnerable function if it exists in the public schema
DROP FUNCTION IF EXISTS public.rls_auto_enable() CASCADE;

-- Re-create the event trigger using the secure internal function
CREATE EVENT TRIGGER ensure_rls
ON ddl_command_end
WHEN tag IN ('CREATE TABLE')
EXECUTE FUNCTION internal.rls_auto_enable();



CREATE OR REPLACE FUNCTION internal.current_employee_is_active()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
    SELECT exists (SELECT 1 FROM public.employee_profiles WHERE id = auth.uid() AND is_active = TRUE);
$$;

REVOKE ALL ON FUNCTION internal.current_employee_is_active() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.current_employee_is_active() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION internal.current_employee_role()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.employee_profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

REVOKE ALL ON FUNCTION internal.current_employee_role() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.current_employee_role() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.current_employee_is_active() CASCADE;
DROP FUNCTION IF EXISTS public.current_employee_role() CASCADE;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END; 
$$;

-- Triggers for Updated At
DROP TRIGGER IF EXISTS vouchers_set_updated_at ON public.vouchers;
DROP TRIGGER IF EXISTS employee_profiles_set_updated_at ON public.employee_profiles;
DROP TRIGGER IF EXISTS hotel_rates_set_updated_at ON public.hotel_rates;

CREATE TRIGGER vouchers_set_updated_at 
    BEFORE UPDATE ON public.vouchers 
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER employee_profiles_set_updated_at 
    BEFORE UPDATE ON public.employee_profiles 
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER hotel_rates_set_updated_at 
    BEFORE UPDATE ON public.hotel_rates 
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to prevent basic info updates in hotel_rates
CREATE OR REPLACE FUNCTION public.prevent_hotel_rates_basic_info_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF OLD.hotel_id IS DISTINCT FROM NEW.hotel_id OR
       OLD.market_id IS DISTINCT FROM NEW.market_id OR
       OLD.currency IS DISTINCT FROM NEW.currency OR
       OLD.contract_name IS DISTINCT FROM NEW.contract_name OR
       OLD.valid_from IS DISTINCT FROM NEW.valid_from OR
       OLD.valid_to IS DISTINCT FROM NEW.valid_to THEN
        RAISE EXCEPTION 'Cannot modify basic contract information (Hotel, Market, Currency, Contract Name, Valid From, Valid To) once saved.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hotel_rates_prevent_basic_info_update ON public.hotel_rates;
CREATE TRIGGER hotel_rates_prevent_basic_info_update
    BEFORE UPDATE ON public.hotel_rates
    FOR EACH ROW EXECUTE FUNCTION public.prevent_hotel_rates_basic_info_update();


-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) & POLICIES
-- =============================================================================

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rate_room_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rate_child_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rate_surcharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rate_guide_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rate_room_supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_basis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Employee Profiles RLS Policies
DROP POLICY IF EXISTS "Employees can read own profile" ON public.employee_profiles;
DROP POLICY IF EXISTS "Employees can insert own profile" ON public.employee_profiles;
DROP POLICY IF EXISTS "Employees can update own basic profile" ON public.employee_profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.employee_profiles;

CREATE POLICY "Employees can read own profile" ON public.employee_profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'));

CREATE POLICY "Employees can insert own profile" ON public.employee_profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Employees can update own basic profile" ON public.employee_profiles FOR UPDATE TO authenticated
    USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND role = 'employee' AND is_active = TRUE);

CREATE POLICY "Admins can manage profiles" ON public.employee_profiles FOR ALL TO authenticated
    USING (internal.current_employee_role() = 'admin') WITH CHECK (internal.current_employee_role() = 'admin');

-- Reference Tables RLS Policies (Read for all, write for active employees)
DROP POLICY IF EXISTS "Anyone can read hotels" ON public.hotels;
DROP POLICY IF EXISTS "Employees can manage hotels" ON public.hotels;
DROP POLICY IF EXISTS "Anyone can read markets" ON public.markets;
DROP POLICY IF EXISTS "Employees can manage markets" ON public.markets;
DROP POLICY IF EXISTS "Anyone can read room categories" ON public.room_categories;
DROP POLICY IF EXISTS "Employees can manage room categories" ON public.room_categories;
DROP POLICY IF EXISTS "Anyone can read customers" ON public.customers;
DROP POLICY IF EXISTS "Employees can manage customers" ON public.customers;

CREATE POLICY "Anyone can read hotels" ON public.hotels FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Employees can manage hotels" ON public.hotels FOR ALL TO authenticated
    USING (internal.current_employee_is_active()) WITH CHECK (internal.current_employee_is_active());

CREATE POLICY "Anyone can read markets" ON public.markets FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Employees can manage markets" ON public.markets FOR ALL TO authenticated
    USING (internal.current_employee_is_active()) WITH CHECK (internal.current_employee_is_active());

CREATE POLICY "Anyone can read room categories" ON public.room_categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Employees can manage room categories" ON public.room_categories FOR ALL TO authenticated
    USING (internal.current_employee_is_active()) WITH CHECK (internal.current_employee_is_active());

CREATE POLICY "Anyone can read customers" ON public.customers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Employees can manage customers" ON public.customers FOR ALL TO authenticated
    USING (internal.current_employee_is_active()) WITH CHECK (internal.current_employee_is_active());

DROP POLICY IF EXISTS "Anyone can read tour types" ON public.tour_types;
DROP POLICY IF EXISTS "Employees can manage tour types" ON public.tour_types;
DROP POLICY IF EXISTS "Anyone can read meal basis" ON public.meal_basis;
DROP POLICY IF EXISTS "Employees can manage meal basis" ON public.meal_basis;
DROP POLICY IF EXISTS "Anyone can read currencies" ON public.currencies;
DROP POLICY IF EXISTS "Employees can manage currencies" ON public.currencies;

CREATE POLICY "Anyone can read tour types" ON public.tour_types FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Employees can manage tour types" ON public.tour_types FOR ALL TO authenticated
    USING (internal.current_employee_is_active()) WITH CHECK (internal.current_employee_is_active());

CREATE POLICY "Anyone can read meal basis" ON public.meal_basis FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Employees can manage meal basis" ON public.meal_basis FOR ALL TO authenticated
    USING (internal.current_employee_is_active()) WITH CHECK (internal.current_employee_is_active());

CREATE POLICY "Anyone can read currencies" ON public.currencies FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Employees can manage currencies" ON public.currencies FOR ALL TO authenticated
    USING (internal.current_employee_is_active()) WITH CHECK (internal.current_employee_is_active());

-- Vouchers RLS Policies
DROP POLICY IF EXISTS "Employees can read vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Employees can insert vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Employees can update vouchers" ON public.vouchers;

CREATE POLICY "Employees can read vouchers" ON public.vouchers FOR SELECT TO authenticated
    USING (internal.current_employee_is_active() AND (created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin')));

CREATE POLICY "Employees can insert vouchers" ON public.vouchers FOR INSERT TO authenticated
    WITH CHECK (internal.current_employee_is_active() AND created_by = auth.uid());

CREATE POLICY "Employees can update vouchers" ON public.vouchers FOR UPDATE TO authenticated
    USING (internal.current_employee_is_active() AND (created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin')))
    WITH CHECK (internal.current_employee_is_active() AND (created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin')));

-- Voucher Line Items RLS Policies (Inherit from parent voucher)
DROP POLICY IF EXISTS "Employees can read voucher line items" ON public.voucher_line_items;
DROP POLICY IF EXISTS "Employees can insert voucher line items" ON public.voucher_line_items;
DROP POLICY IF EXISTS "Employees can update voucher line items" ON public.voucher_line_items;
DROP POLICY IF EXISTS "Employees can delete voucher line items" ON public.voucher_line_items;

CREATE POLICY "Employees can read voucher line items" ON public.voucher_line_items FOR SELECT TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_id AND (v.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can insert voucher line items" ON public.voucher_line_items FOR INSERT TO authenticated
    WITH CHECK (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_id AND (v.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can update voucher line items" ON public.voucher_line_items FOR UPDATE TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_id AND (v.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can delete voucher line items" ON public.voucher_line_items FOR DELETE TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_id AND (v.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

-- Voucher Documents RLS Policies
DROP POLICY IF EXISTS "Employees can read voucher documents" ON public.voucher_documents;
DROP POLICY IF EXISTS "Employees can insert voucher documents" ON public.voucher_documents;

CREATE POLICY "Employees can read voucher documents" ON public.voucher_documents FOR SELECT TO authenticated
    USING (internal.current_employee_is_active() AND (created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin')));

CREATE POLICY "Employees can insert voucher documents" ON public.voucher_documents FOR INSERT TO authenticated
    WITH CHECK (internal.current_employee_is_active() AND created_by = auth.uid());

-- Voucher Revisions RLS Policies
DROP POLICY IF EXISTS "Employees can read voucher revisions" ON public.voucher_revisions;
DROP POLICY IF EXISTS "Employees can insert voucher revisions" ON public.voucher_revisions;

CREATE POLICY "Employees can read voucher revisions" ON public.voucher_revisions FOR SELECT TO authenticated
    USING (internal.current_employee_is_active() AND (changed_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin')));

CREATE POLICY "Employees can insert voucher revisions" ON public.voucher_revisions FOR INSERT TO authenticated
    WITH CHECK (internal.current_employee_is_active() AND changed_by = auth.uid());

-- Hotel Rates RLS Policies
DROP POLICY IF EXISTS "Employees can read hotel rates" ON public.hotel_rates;
DROP POLICY IF EXISTS "Employees can insert hotel rates" ON public.hotel_rates;
DROP POLICY IF EXISTS "Employees can update hotel rates" ON public.hotel_rates;
DROP POLICY IF EXISTS "Employees can delete hotel rates" ON public.hotel_rates;

CREATE POLICY "Employees can read hotel rates" ON public.hotel_rates FOR SELECT TO authenticated
    USING (internal.current_employee_is_active());

CREATE POLICY "Employees can insert hotel rates" ON public.hotel_rates FOR INSERT TO authenticated
    WITH CHECK (internal.current_employee_is_active() AND created_by = auth.uid());

CREATE POLICY "Employees can update hotel rates" ON public.hotel_rates FOR UPDATE TO authenticated
    USING (internal.current_employee_is_active() AND (created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin')))
    WITH CHECK (internal.current_employee_is_active());

CREATE POLICY "Employees can delete hotel rates" ON public.hotel_rates FOR DELETE TO authenticated
    USING (internal.current_employee_is_active() AND (created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin')));

-- Hotel Rate Child Tables RLS (Inherit ownership from parent hotel_rates)
DROP POLICY IF EXISTS "Employees can read hotel rate room prices" ON public.hotel_rate_room_prices;
DROP POLICY IF EXISTS "Employees can manage hotel rate room prices" ON public.hotel_rate_room_prices;
DROP POLICY IF EXISTS "Employees can read hotel rate child prices" ON public.hotel_rate_child_prices;
DROP POLICY IF EXISTS "Employees can manage hotel rate child prices" ON public.hotel_rate_child_prices;
DROP POLICY IF EXISTS "Employees can read hotel rate surcharges" ON public.hotel_rate_surcharges;
DROP POLICY IF EXISTS "Employees can manage hotel rate surcharges" ON public.hotel_rate_surcharges;
DROP POLICY IF EXISTS "Employees can read hotel rate events" ON public.hotel_rate_events;
DROP POLICY IF EXISTS "Employees can manage hotel rate events" ON public.hotel_rate_events;
DROP POLICY IF EXISTS "Employees can read hotel rate guide prices" ON public.hotel_rate_guide_prices;
DROP POLICY IF EXISTS "Employees can manage hotel rate guide prices" ON public.hotel_rate_guide_prices;
DROP POLICY IF EXISTS "Employees can read hotel rate room supplements" ON public.hotel_rate_room_supplements;
DROP POLICY IF EXISTS "Employees can manage hotel rate room supplements" ON public.hotel_rate_room_supplements;

CREATE POLICY "Employees can read hotel rate room prices" ON public.hotel_rate_room_prices FOR SELECT TO authenticated
    USING (internal.current_employee_is_active());

CREATE POLICY "Employees can manage hotel rate room prices" ON public.hotel_rate_room_prices FOR ALL TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))))
    WITH CHECK (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can read hotel rate child prices" ON public.hotel_rate_child_prices FOR SELECT TO authenticated
    USING (internal.current_employee_is_active());

CREATE POLICY "Employees can manage hotel rate child prices" ON public.hotel_rate_child_prices FOR ALL TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))))
    WITH CHECK (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can read hotel rate surcharges" ON public.hotel_rate_surcharges FOR SELECT TO authenticated
    USING (internal.current_employee_is_active());

CREATE POLICY "Employees can manage hotel rate surcharges" ON public.hotel_rate_surcharges FOR ALL TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))))
    WITH CHECK (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can read hotel rate events" ON public.hotel_rate_events FOR SELECT TO authenticated
    USING (internal.current_employee_is_active());

CREATE POLICY "Employees can manage hotel rate events" ON public.hotel_rate_events FOR ALL TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))))
    WITH CHECK (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can read hotel rate guide prices" ON public.hotel_rate_guide_prices FOR SELECT TO authenticated
    USING (internal.current_employee_is_active());

CREATE POLICY "Employees can manage hotel rate guide prices" ON public.hotel_rate_guide_prices FOR ALL TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))))
    WITH CHECK (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));

CREATE POLICY "Employees can read hotel rate room supplements" ON public.hotel_rate_room_supplements FOR SELECT TO authenticated
    USING (internal.current_employee_is_active());

CREATE POLICY "Employees can manage hotel rate room supplements" ON public.hotel_rate_room_supplements FOR ALL TO authenticated
    USING (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))))
    WITH CHECK (internal.current_employee_is_active() AND EXISTS (SELECT 1 FROM public.hotel_rates hr WHERE hr.id = hotel_rate_id AND (hr.created_by = auth.uid() OR internal.current_employee_role() IN ('manager', 'admin'))));


-- =============================================================================
-- 8. AUTO-CREATE EMPLOYEE PROFILE ON AUTH SIGN-UP Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION internal.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.employee_profiles (id, employee_name, email, role, is_active)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'employeeName', split_part(NEW.email, '@', 1)), NEW.email, 'employee', TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, employee_name = COALESCE(public.employee_profiles.employee_name, EXCLUDED.employee_name);
    RETURN NEW;
END; 
$$;

REVOKE ALL ON FUNCTION internal.handle_new_auth_user() FROM public, anon, authenticated;

-- Drop old vulnerable function if it exists in the public schema
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users 
    FOR EACH ROW EXECUTE FUNCTION internal.handle_new_auth_user();

-- Backward compatibility sync for existing accounts
INSERT INTO public.employee_profiles (id, employee_name, email, role, is_active)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'employeeName', split_part(u.email, '@', 1)), u.email, 'employee', TRUE
FROM auth.users u 
LEFT JOIN public.employee_profiles p ON p.id = u.id 
WHERE p.id IS NULL;


-- =============================================================================
-- 9. VOUCHER TEMPLATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.voucher_templates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    docx_data  TEXT NOT NULL, -- Base64 encoded docx file
    html_data  TEXT NOT NULL, -- HTML template content
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.voucher_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read voucher templates" ON public.voucher_templates;
DROP POLICY IF EXISTS "Employees can manage voucher templates" ON public.voucher_templates;
DROP POLICY IF EXISTS "Admins can manage voucher templates" ON public.voucher_templates;

CREATE POLICY "Anyone can read voucher templates" ON public.voucher_templates FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage voucher templates" ON public.voucher_templates FOR ALL TO authenticated
    USING (internal.current_employee_is_active() AND internal.current_employee_role() IN ('manager', 'admin'))
    WITH CHECK (internal.current_employee_is_active() AND internal.current_employee_role() IN ('manager', 'admin'));


-- =============================================================================
-- 10. DATA API EXPLICIT GRANTS (Supabase Security Mandates)
-- =============================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, authenticated, service_role;

