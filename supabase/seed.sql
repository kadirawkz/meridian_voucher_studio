-- Seed Test Data for Galle Face Hotel & Cinnamon Grand Hotel
-- This script safely inserts reference lookups, parent hotel rate contracts, room prices, child rates, guide rates, supplements, seasonal surcharges, and compulsory events.

DO $$
DECLARE
    v_employee_id          UUID;
    v_hotel_id             UUID;
    v_market_id            UUID;
    v_superior_cat_id      UUID;
    v_deluxe_cat_id        UUID;
    v_suite_cat_id         UUID;
    v_rate_id              UUID;
BEGIN
    -- =========================================================================
    -- 1. Seed Distinct Testing Accounts (Admins, Managers, and Employees)
    -- =========================================================================

    -- Seed Admin: admin@meridian.com (password123)
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, created_at, updated_at
    )
    VALUES (
        'd7b6f7e8-4a5e-4b6c-8d9e-0f1a2b3c4d5e', '00000000-0000-0000-0000-000000000000',
        'admin@meridian.com', '$2a$10$wK1c6F0gL3q4.u6wJtE0be2.1m4.qW6.9O3K.1gJ.lB8N.0e9N.m.', NOW(),
        '{"provider":"email","providers":["email"]}', '{"employeeName":"Test Admin"}', FALSE, 'authenticated', 'authenticated', NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.employee_profiles (id, employee_name, email, role, is_active)
    VALUES ('d7b6f7e8-4a5e-4b6c-8d9e-0f1a2b3c4d5e', 'Test Admin', 'admin@meridian.com', 'admin', TRUE)
    ON CONFLICT (id) DO UPDATE SET role = 'admin', employee_name = 'Test Admin';

    v_employee_id := 'd7b6f7e8-4a5e-4b6c-8d9e-0f1a2b3c4d5e'; -- Fallback creator ID for other seeds

    -- Seed Manager: manager@meridian.com (password123)
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, created_at, updated_at
    )
    VALUES (
        'e8c7a8b9-5f6e-4c7d-9e0f-1a2b3c4d5e6f', '00000000-0000-0000-0000-000000000000',
        'manager@meridian.com', '$2a$10$wK1c6F0gL3q4.u6wJtE0be2.1m4.qW6.9O3K.1gJ.lB8N.0e9N.m.', NOW(),
        '{"provider":"email","providers":["email"]}', '{"employeeName":"Test Manager"}', FALSE, 'authenticated', 'authenticated', NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.employee_profiles (id, employee_name, email, role, is_active)
    VALUES ('e8c7a8b9-5f6e-4c7d-9e0f-1a2b3c4d5e6f', 'Test Manager', 'manager@meridian.com', 'manager', TRUE)
    ON CONFLICT (id) DO UPDATE SET role = 'manager', employee_name = 'Test Manager';

    -- Seed Standard Employee: employee@meridian.com (password123)
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, created_at, updated_at
    )
    VALUES (
        'f9d8b9c0-6a7b-5d8e-0f1a-2b3c4d5e6f7a', '00000000-0000-0000-0000-000000000000',
        'employee@meridian.com', '$2a$10$wK1c6F0gL3q4.u6wJtE0be2.1m4.qW6.9O3K.1gJ.lB8N.0e9N.m.', NOW(),
        '{"provider":"email","providers":["email"]}', '{"employeeName":"Test Employee"}', FALSE, 'authenticated', 'authenticated', NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.employee_profiles (id, employee_name, email, role, is_active)
    VALUES ('f9d8b9c0-6a7b-5d8e-0f1a-2b3c4d5e6f7a', 'Test Employee', 'employee@meridian.com', 'employee', TRUE)
    ON CONFLICT (id) DO UPDATE SET role = 'employee', employee_name = 'Test Employee';


    -- =========================================================================
    -- 2. Seed Static Reference Data Tables
    -- =========================================================================

    -- Markets
    INSERT INTO public.markets (code, name, is_active)
    VALUES ('LOCAL', 'Local Market', TRUE),
           ('UK', 'United Kingdom', TRUE),
           ('EUROPE', 'European Union', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    
    SELECT id INTO v_market_id FROM public.markets WHERE code = 'LOCAL';

    -- Room Categories
    INSERT INTO public.room_categories (name, is_active)
    VALUES ('Superior Room', TRUE),
           ('Deluxe Room', TRUE),
           ('Heritage Suite', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE;
    
    SELECT id INTO v_superior_cat_id FROM public.room_categories WHERE name = 'Superior Room';
    SELECT id INTO v_deluxe_cat_id FROM public.room_categories WHERE name = 'Deluxe Room';
    SELECT id INTO v_suite_cat_id FROM public.room_categories WHERE name = 'Heritage Suite';

    -- Currencies
    INSERT INTO public.currencies (code, name, is_active)
    VALUES ('USD', 'US Dollar', TRUE),
           ('LKR', 'Sri Lankan Rupee', TRUE),
           ('EUR', 'Euro', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Customers
    INSERT INTO public.customers (name, is_active)
    VALUES ('Meridian Travels', TRUE),
           ('Scenic Tours', TRUE),
           ('Elite Holidays', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE;

    -- Tour Types & Meal Basis
    INSERT INTO public.tour_types (code, name, is_active)
    VALUES ('SL', 'Standard Leisure', TRUE),
           ('WSL', 'Winter Special Leisure', TRUE),
           ('CSL', 'Classic Sri Lanka', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    INSERT INTO public.meal_basis (code, name, is_active)
    VALUES ('BB', 'Bed & Breakfast', TRUE),
           ('HB', 'Half Board', TRUE),
           ('FB', 'Full Board', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;


    -- =========================================================================
    -- 3. Seed Galle Face Hotel & Its FIT Rates (FOC Rules, Room Prices, etc.)
    -- =========================================================================

    INSERT INTO public.hotels (name, is_active)
    VALUES ('Galle Face Hotel', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_hotel_id;

    -- Clean up previous rates for Galle Face Hotel to ensure idempotency (cascades)
    DELETE FROM public.hotel_rates WHERE hotel_id = v_hotel_id;

    -- Parent Hotel Rate Contract
    INSERT INTO public.hotel_rates (
        hotel_id, market_id, currency, contract_name, 
        valid_from, valid_to, billing_instruction, created_by,
        foc_enabled, foc_applies_to, foc_minimum_persons, foc_quantity, foc_basis,
        foc_count_adults, foc_count_child_2_5_99, foc_count_child_6_11_99,
        foc_pax_custom_text, foc_guide_custom_text, is_active
    )
    VALUES (
        v_hotel_id, v_market_id, 'USD', 'FIT Special Contract 2026', 
        '2026-01-01', '2026-12-31', 'All rates are net and inclusive of taxes.', v_employee_id,
        TRUE, 'Pax,Guide', 15, 1, 'HB',
        TRUE, FALSE, FALSE,
        '1 Pax FOC on HB basis for minimum 15 Pax', '1 Guide FOC on HB basis for minimum 15 Pax', TRUE
    )
    ON CONFLICT (hotel_id, market_id, contract_name, valid_from, valid_to) 
    DO UPDATE SET 
        billing_instruction = EXCLUDED.billing_instruction,
        foc_enabled = EXCLUDED.foc_enabled,
        foc_applies_to = EXCLUDED.foc_applies_to,
        foc_minimum_persons = EXCLUDED.foc_minimum_persons,
        foc_quantity = EXCLUDED.foc_quantity,
        foc_basis = EXCLUDED.foc_basis,
        foc_count_adults = EXCLUDED.foc_count_adults,
        foc_count_child_2_5_99 = EXCLUDED.foc_count_child_2_5_99,
        foc_count_child_6_11_99 = EXCLUDED.foc_count_child_6_11_99,
        foc_pax_custom_text = EXCLUDED.foc_pax_custom_text,
        foc_guide_custom_text = EXCLUDED.foc_guide_custom_text,
        is_active = TRUE
    RETURNING id INTO v_rate_id;

    -- Room Prices (Superior & Deluxe for BB & HB)
    INSERT INTO public.hotel_rate_room_prices (
        hotel_rate_id, valid_from, valid_to, room_category_id, basis, sgl, dbl, twn, tpl
    )
    VALUES 
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'BB', 120.00, 140.00, 140.00, 180.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'BB', 160.00, 180.00, 180.00, 220.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'HB', 150.00, 200.00, 200.00, 270.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'HB', 190.00, 240.00, 240.00, 310.00)
    ON CONFLICT DO NOTHING;

    -- Child Prices
    INSERT INTO public.hotel_rate_child_prices (
        hotel_rate_id, valid_from, valid_to, room_category_id, basis,
        age_2_5_99_sharing, age_2_5_99_extra_bed, age_2_5_99_own_room,
        age_6_11_99_sharing, age_6_11_99_extra_bed, age_6_11_99_own_room
    )
    VALUES
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'BB', 'FOC', '15.00', '40.00', '20.00', '30.00', '60.00'),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'BB', 'FOC', '20.00', '50.00', '25.00', '35.00', '70.00'),
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'HB', 'FOC', '25.00', '55.00', '30.00', '45.00', '80.00'),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'HB', 'FOC', '30.00', '65.00', '35.00', '50.00', '90.00')
    ON CONFLICT DO NOTHING;

    -- Guide Rates
    INSERT INTO public.hotel_rate_guide_prices (
        hotel_rate_id, basis, rate
    )
    VALUES
        (v_rate_id, 'BB', 35.00),
        (v_rate_id, 'HB', 50.00),
        (v_rate_id, 'FB', 65.00)
    ON CONFLICT DO NOTHING;

    -- Seasonal Surcharges
    INSERT INTO public.hotel_rate_surcharges (
        hotel_rate_id, name, amount, date_from, date_to, applies_to
    )
    VALUES
        (v_rate_id, 'Peak Season Surcharge', 50.00, '2026-12-15', '2026-12-31', 'All'),
        (v_rate_id, 'Perahera Season Surcharge', 30.00, '2026-08-01', '2026-08-10', 'All')
    ON CONFLICT DO NOTHING;

    -- Room Supplements
    INSERT INTO public.hotel_rate_room_supplements (
        hotel_rate_id, room_category_id, supplement_name, supplement_amount, per
    )
    VALUES 
        (v_rate_id, v_superior_cat_id, 'Ocean View supplement', 35.00, 'per room per night'),
        (v_rate_id, v_deluxe_cat_id, 'Ocean View supplement', 45.00, 'per room per night')
    ON CONFLICT DO NOTHING;

    -- Compulsory Events
    INSERT INTO public.hotel_rate_events (
        hotel_rate_id, event_date, event_name, bb_rate, hb_rate, fb_rate, per, mandatory
    )
    VALUES 
        (v_rate_id, '2026-12-24', 'Christmas Eve Gala Dinner', 75.00, 50.00, 50.00, 'Person', TRUE),
        (v_rate_id, '2026-12-31', 'New Years Eve Gala Dinner', 95.00, 70.00, 70.00, 'Person', TRUE)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Galle Face Hotel Rate successfully seeded for testing.';


    -- =========================================================================
    -- 4. Seed Cinnamon Grand Hotel & Its FIT Rates (FOC Rules, Room Prices, etc.)
    -- =========================================================================

    INSERT INTO public.hotels (name, is_active)
    VALUES ('Cinnamon Grand', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_hotel_id;

    -- Clean up previous rates for Cinnamon Grand to ensure idempotency (cascades)
    DELETE FROM public.hotel_rates WHERE hotel_id = v_hotel_id;

    -- Parent Hotel Rate Contract
    INSERT INTO public.hotel_rates (
        hotel_id, market_id, currency, contract_name, 
        valid_from, valid_to, billing_instruction, created_by,
        foc_enabled, foc_applies_to, foc_minimum_persons, foc_quantity, foc_basis,
        foc_count_adults, foc_count_child_2_5_99, foc_count_child_6_11_99,
        foc_pax_custom_text, foc_guide_custom_text, is_active
    )
    VALUES (
        v_hotel_id, v_market_id, 'USD', 'FIT Standard Contract 2026', 
        '2026-01-01', '2026-12-31', 'Net non-commissionable rates, including taxes.', v_employee_id,
        TRUE, 'Guide', 10, 1, 'BB',
        TRUE, FALSE, FALSE,
        '', '1 Guide FOC on BB basis for minimum 10 Pax', TRUE
    )
    ON CONFLICT (hotel_id, market_id, contract_name, valid_from, valid_to) 
    DO UPDATE SET 
        billing_instruction = EXCLUDED.billing_instruction,
        foc_enabled = EXCLUDED.foc_enabled,
        foc_applies_to = EXCLUDED.foc_applies_to,
        foc_minimum_persons = EXCLUDED.foc_minimum_persons,
        foc_quantity = EXCLUDED.foc_quantity,
        foc_basis = EXCLUDED.foc_basis,
        foc_count_adults = EXCLUDED.foc_count_adults,
        foc_count_child_2_5_99 = EXCLUDED.foc_count_child_2_5_99,
        foc_count_child_6_11_99 = EXCLUDED.foc_count_child_6_11_99,
        foc_pax_custom_text = EXCLUDED.foc_pax_custom_text,
        foc_guide_custom_text = EXCLUDED.foc_guide_custom_text,
        is_active = TRUE
    RETURNING id INTO v_rate_id;

    -- Room Prices (Superior & Deluxe for BB & HB)
    INSERT INTO public.hotel_rate_room_prices (
        hotel_rate_id, valid_from, valid_to, room_category_id, basis, sgl, dbl, twn, tpl
    )
    VALUES 
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'BB', 135.00, 155.00, 155.00, 195.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'BB', 175.00, 195.00, 195.00, 235.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'HB', 165.00, 215.00, 215.00, 285.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'HB', 205.00, 255.00, 255.00, 325.00)
    ON CONFLICT DO NOTHING;

    -- Child Prices
    INSERT INTO public.hotel_rate_child_prices (
        hotel_rate_id, valid_from, valid_to, room_category_id, basis,
        age_2_5_99_sharing, age_2_5_99_extra_bed, age_2_5_99_own_room,
        age_6_11_99_sharing, age_6_11_99_extra_bed, age_6_11_99_own_room
    )
    VALUES
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'BB', 'FOC', '18.00', '42.00', '22.00', '32.00', '62.00'),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'BB', 'FOC', '22.00', '52.00', '27.00', '37.00', '72.00')
    ON CONFLICT DO NOTHING;

    -- Guide Rates
    INSERT INTO public.hotel_rate_guide_prices (
        hotel_rate_id, basis, rate
    )
    VALUES
        (v_rate_id, 'BB', 38.00),
        (v_rate_id, 'HB', 52.00)
    ON CONFLICT DO NOTHING;

    -- Room Supplements
    INSERT INTO public.hotel_rate_room_supplements (
        hotel_rate_id, room_category_id, supplement_name, supplement_amount, per
    )
    VALUES 
        (v_rate_id, v_superior_cat_id, 'Premium City View supplement', 25.00, 'per room per night'),
        (v_rate_id, v_deluxe_cat_id, 'Premium City View supplement', 35.00, 'per room per night')
    ON CONFLICT DO NOTHING;

    -- Seasonal Surcharges
    INSERT INTO public.hotel_rate_surcharges (
        hotel_rate_id, name, amount, date_from, date_to, applies_to
    )
    VALUES
        (v_rate_id, 'Peak Season Surcharge', 60.00, '2026-12-15', '2026-12-31', 'All'),
        (v_rate_id, 'Perahera Season Surcharge', 40.00, '2026-08-01', '2026-08-10', 'All')
    ON CONFLICT DO NOTHING;

    -- Compulsory Events
    INSERT INTO public.hotel_rate_events (
        hotel_rate_id, event_date, event_name, bb_rate, hb_rate, fb_rate, per, mandatory
    )
    VALUES 
        (v_rate_id, '2026-12-24', 'Christmas Eve Dinner Dance', 80.00, 55.00, 55.00, 'Person', TRUE),
        (v_rate_id, '2026-12-31', 'New Years Eve Gala Dinner', 100.00, 75.00, 75.00, 'Person', TRUE)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Cinnamon Grand Hotel Rate successfully seeded for testing.';
END $$;
