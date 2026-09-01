-- description: Het type deelnemer (van all_registrations) voor de aanlevering: 2 voor leiding, 1 voor leden, 0 voor wie niet meegeteld wordt. De ondersteunende leden tellen hier als leiding, want het sjabloon heeft geen derde woord voor hen.
CASE
    WHEN all_registrations.age_group_category = 'leader' THEN 2
    WHEN all_registrations.age_group_id = 'a28d290c-af71-4282-92cc-2224a18d3091' THEN 2  -- Ondersteunende leden
    WHEN all_registrations.age_group_category = 'child' THEN 1
    ELSE 0
END
