-- description: De werkjaren waarin iemand lid was, elk met het jaar erna ('volgend'): waar het ledenbehoud tegen afgezet wordt.
WITH leden_per_jaar AS (
    -- @include members-per-year
)
-- Grouped by name rather than id, since every eenheid holds its own period row for the same year.
-- Only the years that have leden: `volgend` would otherwise point at an empty year and read as 0%
-- ledenbehoud.
SELECT name, MIN(startDate) AS startDate, LEAD(name) OVER (ORDER BY MIN(startDate)) AS volgend
FROM registration_periods
WHERE name IN (SELECT `Werkjaar` FROM leden_per_jaar)
GROUP BY name
