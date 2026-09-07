-- description: Het type deelnemer (van all_registrations) voor de aanlevering: 2 voor leiding, 1 voor leden, 0 voor wie niet meegeteld wordt. De stam telt hier bij de leden en de ondersteunende leden bij de leiding, want het sjabloon heeft geen derde woord voor hen. Wie geen aansluiting heeft die de aanlevering meetelt, staat er sowieso niet in.
CASE
    WHEN all_registrations.age_group_category = 'leader' THEN 2
    WHEN all_registrations.age_group_id = 'ac8848e9-9868-44a1-a057-2a189cce68ea' THEN 2  -- Ondersteunende leden
    WHEN all_registrations.age_group_category = 'child' THEN 1
    WHEN all_registrations.age_group_id = '6fc0775e-2851-4fe1-90cd-af9c74243ccd' THEN 1  -- Stam
    ELSE 0
END
