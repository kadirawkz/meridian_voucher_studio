-- Seed Test Data for Galle Face Hotel
-- This script safely inserts reference lookups, a parent hotel rate contract, room prices, child rates, guide rates, supplements, seasonal surcharges, and compulsory events.

DO $$
DECLARE
    v_employee_id uuid;
    v_hotel_id uuid;
    v_market_id uuid;
    v_superior_cat_id uuid;
    v_deluxe_cat_id uuid;
    v_suite_cat_id uuid;
    v_rate_id uuid;
BEGIN
    -- 1. Resolve a valid employee profile ID for created_by
    select id into v_employee_id from public.employee_profiles limit 1;
    
    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'No employee profile found in public.employee_profiles. Please register or sign up an employee first.';
    END IF;

    -- 2. Seed Hotels
    insert into public.hotels (name, is_active)
    values ('Galle Face Hotel', true)
    on conflict (name) do update set is_active = true
    returning id into v_hotel_id;

    -- 3. Seed Markets
    insert into public.markets (code, name)
    values ('LOCAL', 'Local Market'),
           ('UK', 'United Kingdom'),
           ('EUROPE', 'European Union')
    on conflict (code) do nothing;
    
    select id into v_market_id from public.markets where code = 'LOCAL';

    -- 4. Seed Room Categories
    insert into public.room_categories (name)
    values ('Superior Room'),
           ('Deluxe Room'),
           ('Heritage Suite')
    on conflict (name) do nothing;
    
    select id into v_superior_cat_id from public.room_categories where name = 'Superior Room';
    select id into v_deluxe_cat_id from public.room_categories where name = 'Deluxe Room';
    select id into v_suite_cat_id from public.room_categories where name = 'Heritage Suite';

    -- 5. Seed Currencies
    insert into public.currencies (code, name)
    values ('USD', 'US Dollar'),
           ('LKR', 'Sri Lankan Rupee'),
           ('EUR', 'Euro')
    on conflict (code) do nothing;

    -- 6. Seed Tour Types & Meal Basis Reference Lists (empty by default, seeded here for testing)
    insert into public.tour_types (code, name)
    values ('SL', 'Standard Leisure'),
           ('WSL', 'Winter Special Leisure'),
           ('CSL', 'Classic Sri Lanka')
    on conflict (code) do nothing;

    insert into public.meal_basis (code, name)
    values ('BB', 'Bed & Breakfast'),
           ('HB', 'Half Board'),
           ('FB', 'Full Board')
    on conflict (code) do nothing;

    -- 7. Seed Parent Hotel Rate with Active FOC Rules (Galle Face Hotel, LOCAL market, FIT Rate Contract, USD)
    insert into public.hotel_rates (
        hotel_id, market_id, currency, contract_name, 
        valid_from, valid_to, billing_instruction, created_by,
        foc_enabled, foc_applies_to, foc_minimum_persons, foc_quantity, foc_basis,
        foc_count_adults, foc_count_child_2_5, foc_count_child_6_11
    )
    values (
        v_hotel_id, v_market_id, 'USD', 'FIT Special Contract 2026', 
        '2026-01-01', '2026-12-31', 'All rates are net and inclusive of taxes.', v_employee_id,
        true, 'Guide', 15, 1, 'HB',
        true, false, false
    )
    on conflict (hotel_id, market_id, contract_name, valid_from, valid_to) 
    do update set 
        billing_instruction = excluded.billing_instruction,
        foc_enabled = excluded.foc_enabled,
        foc_applies_to = excluded.foc_applies_to,
        foc_minimum_persons = excluded.foc_minimum_persons,
        foc_quantity = excluded.foc_quantity,
        foc_basis = excluded.foc_basis,
        foc_count_adults = excluded.foc_count_adults,
        foc_count_child_2_5 = excluded.foc_count_child_2_5,
        foc_count_child_6_11 = excluded.foc_count_child_6_11
    returning id into v_rate_id;

    -- 8. Seed Room Prices (Superior & Deluxe Rooms for both BB and HB)
    -- BB basis
    insert into public.hotel_rate_room_prices (
        hotel_rate_id, valid_from, valid_to, room_category_id, basis, sgl, dbl, twn, tpl
    )
    values 
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'BB', 120.00, 140.00, 140.00, 180.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'BB', 160.00, 180.00, 180.00, 220.00)
    on conflict do nothing;

    -- HB basis
    insert into public.hotel_rate_room_prices (
        hotel_rate_id, valid_from, valid_to, room_category_id, basis, sgl, dbl, twn, tpl
    )
    values 
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'HB', 150.00, 200.00, 200.00, 270.00),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'HB', 190.00, 240.00, 240.00, 310.00)
    on conflict do nothing;

    -- 9. Seed Child Prices (For sharing, extra bed, own room)
    insert into public.hotel_rate_child_prices (
        hotel_rate_id, valid_from, valid_to, room_category_id, basis,
        age_2_5_sharing, age_2_5_extra_bed, age_2_5_own_room,
        age_6_11_sharing, age_6_11_extra_bed, age_6_11_own_room
    )
    values
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'BB', 'FOC', '15.00', '40.00', '20.00', '30.00', '60.00'),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'BB', 'FOC', '20.00', '50.00', '25.00', '35.00', '70.00'),
        (v_rate_id, '2026-01-01', '2026-12-31', v_superior_cat_id, 'HB', 'FOC', '25.00', '55.00', '30.00', '45.00', '80.00'),
        (v_rate_id, '2026-01-01', '2026-12-31', v_deluxe_cat_id, 'HB', 'FOC', '30.00', '65.00', '35.00', '50.00', '90.00')
    on conflict do nothing;

    -- 10. Seed Guide Rates
    insert into public.hotel_rate_guide_prices (
        hotel_rate_id, basis, rate
    )
    values
        (v_rate_id, 'BB', 35.00),
        (v_rate_id, 'HB', 50.00),
        (v_rate_id, 'FB', 65.00)
    on conflict do nothing;

    -- 11. Seed Seasonal Surcharges
    insert into public.hotel_rate_surcharges (
        hotel_rate_id, name, amount, date_from, date_to, applies_to
    )
    values
        (v_rate_id, 'Peak Season Surcharge', 50.00, '2026-12-15', '2026-12-31', 'Room'),
        (v_rate_id, 'Perahera Season Surcharge', 30.00, '2026-08-01', '2026-08-10', 'Room')
    on conflict do nothing;

    -- 12. Seed Room Supplements (e.g. Ocean View Uplift)
    insert into public.hotel_rate_room_supplements (
        hotel_rate_id, room_category_id, supplement_name, supplement_amount, per
    )
    values 
        (v_rate_id, v_superior_cat_id, 'Ocean View supplement', 35.00, 'per room per night'),
        (v_rate_id, v_deluxe_cat_id, 'Ocean View supplement', 45.00, 'per room per night')
    on conflict do nothing;

    -- 13. Seed Compulsory Dinner Event Surcharges
    insert into public.hotel_rate_events (
        hotel_rate_id, event_date, event_name, bb_rate, hb_rate, fb_rate, per, mandatory
    )
    values 
        (v_rate_id, '2026-12-24', 'Christmas Eve Gala Dinner', 75.00, 50.00, 50.00, 'Person', true),
        (v_rate_id, '2026-12-31', 'New Years Eve Gala Dinner', 95.00, 70.00, 70.00, 'Person', true)
    on conflict do nothing;

    RAISE NOTICE 'Galle Face Hotel Rate successfully seeded for testing.';
END $$;
