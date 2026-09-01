-- description: Het type deelnemer (van all_registrations) voor de aanlevering: 2 voor leiding, 1 voor leden, 0 voor wie niet meegeteld wordt.
CASE WHEN all_registrations.age_group_category = 'leader' THEN 2 WHEN all_registrations.age_group_category = 'child' THEN 1 ELSE 0 END
