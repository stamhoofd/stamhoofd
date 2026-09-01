, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LEAD(name) OVER (ORDER BY MIN(startDate)) AS volgend
    FROM registration_periods
    WHERE name IN (SELECT `Scoutsjaar` FROM leden_per_jaar)
    GROUP BY name
)
