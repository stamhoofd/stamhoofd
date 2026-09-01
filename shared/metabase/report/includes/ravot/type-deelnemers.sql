CASE
    WHEN f.tak_category = 'leader' THEN 2
    WHEN f.tak_id = 'a28d290c-af71-4282-92cc-2224a18d3091' THEN 2  -- Ondersteunende leden
    WHEN f.tak_category = 'child' THEN 1
    ELSE 0
END
