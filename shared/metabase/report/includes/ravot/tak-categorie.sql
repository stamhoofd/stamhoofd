CASE dag.id
    -- Kinderen
    WHEN 'bd63a6ef-d4a1-497d-87a5-d7c36b4ad220' THEN 'child'   -- Leeuwkes, Kabouters of Sloebers (6-8)
    WHEN '23607074-624b-472f-926f-c719bb44e314' THEN 'child'   -- Springers of Pagadders (8-10)
    WHEN '5730f613-fb72-465b-b902-45b281a0e8b8' THEN 'child'   -- Jongknapen, Roodkapjes of Joro's (10-12)
    WHEN '3d56a0b2-9f4b-46ac-998b-d45a9b64cab2' THEN 'child'   -- Knapen, Jimmers of Knimmers (12-14)
    WHEN '03680919-689c-4df1-8976-bb71758cc025' THEN 'child'   -- Sjo'ers, Simmers of Jonghernieuwers (14-16)
    WHEN 'bed9b513-e0ff-4cc3-a0f3-1c021fc880a9' THEN 'child'   -- +16, leiding in spe (16 en ouder)
    WHEN '1ad6b686-d5fa-4168-8fa2-064d49f8c0e8' THEN 'child'   -- Hernieuwers
    -- Leiding
    WHEN 'e3ec8d48-0d10-4f5d-9e50-dd3151c6666b' THEN 'leader'  -- Leiding
    -- Volwassenen
    WHEN 'a28d290c-af71-4282-92cc-2224a18d3091' THEN 'adult'   -- Ondersteunende leden
END AS category
