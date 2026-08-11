-- Elk scoutsjaar met het scoutsjaar ervoor, waartegen het ledenbehoud gemeten wordt. Een scoutsjaar is
-- de naam van de periode: elke eenheid houdt een eigen periode-rij voor hetzelfde jaar, dus alleen de
-- naam is over alle eenheden heen hetzelfde.
--
-- Alleen jaren met leden vormen de ketting. Een periode zonder leden -- een jaar dat nog niet
-- gesynchroniseerd is, of een eigen periode van een eenheid -- zou het jaar erna anders op 0%
-- ledenbehoud zetten, en het jaar zelf heeft leden nodig om er nog lid in te kunnen zijn.
--
-- Hoort na `leden-per-jaar`, waar het de jaren met leden uit haalt.
, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LAG(name) OVER (ORDER BY MIN(startDate)) AS vorig
    FROM registration_periods
    WHERE name IN (SELECT `Scoutsjaar` FROM leden_per_jaar)
    GROUP BY name
)
