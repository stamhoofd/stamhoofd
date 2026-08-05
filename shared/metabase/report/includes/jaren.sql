-- Elk scoutsjaar met het scoutsjaar erna, waarin het ledenbehoud van dat jaar gemeten wordt. Een
-- scoutsjaar is de naam van de periode: elke eenheid houdt een eigen periode-rij voor hetzelfde jaar,
-- dus alleen de naam is over alle eenheden heen hetzelfde.
--
-- Het ledenbehoud hoort bij het jaar van de leden zelf, niet bij het jaar waarin ze terugkomen: naast
-- scoutsjaar N staat het percentage van de leden van N dat in N+1 nog lid was, zoals het rapport van
-- de klant het ook zet. Het laatste jaar heeft daardoor geen cijfer -- `volgend` is dan NULL -- en
-- moet uit elke kaart gefilterd worden, anders leest het als 0% ledenbehoud.
--
-- Alleen jaren met leden vormen de ketting. Een periode zonder leden -- een jaar dat nog niet
-- gesynchroniseerd is, of een eigen periode van een eenheid -- zou het jaar ervoor anders op 0%
-- ledenbehoud zetten, en het jaar zelf heeft leden nodig om er lid in te kunnen zijn.
--
-- Hoort na `leden-per-jaar`, waar het de jaren met leden uit haalt.
, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LEAD(name) OVER (ORDER BY MIN(startDate)) AS volgend
    FROM registration_periods
    WHERE name IN (SELECT `Scoutsjaar` FROM leden_per_jaar)
    GROUP BY name
)
