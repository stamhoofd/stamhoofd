-- @tab gtp
-- title: GTP per eenheid
-- description: De GTP-index van elke eenheid over het gekozen werkjaar en de twee werkjaren ervoor, om de eenheden te vinden die het moeilijker hebben.
-- filters: werkjaar, platformleden_opnemen
-- required: werkjaar

-- @card gtp-per-eenheid
-- title: GTP per eenheid over drie werkjaren
-- display: table
-- size: full
-- height: 16
-- metrics: GTP twee werkjaren eerder, GTP vorig werkjaar, GTP dit werkjaar
-- segments: 0, 35, 55, 75, 95, 115, 135
-- highlight: Opvolgen
-- defaults: aantal_werkjaren = 3
-- description: GTP staat voor Gezond Toekomst Perspectief. Een cel kleurt volgens de GTP: groen vanaf 115, rood onder 35. Een rij kleurt wanneer de eenheid opgevolgd moet worden: geel als de GTP van dit werkjaar onder 55 ligt, oranje als ze minstens 10 punten lager ligt dan twee werkjaren eerder, rood als beide gelden. Enkel eenheden met leden in het gekozen werkjaar staan in de lijst.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
),
-- Zie `leden-per-leeftijdsgroep-vergelijking`: ook een jaar zonder leden telt als vorig werkjaar.
jaren AS (
    SELECT
        name,
        MIN(startDate) AS startDate,
        LAG(name) OVER (ORDER BY MIN(startDate)) AS vorig,
        LAG(name, 2) OVER (ORDER BY MIN(startDate)) AS voorvorig
    FROM registration_periods
    GROUP BY name
),
-- The selected year, or the most recent one when the filter is empty.
gekozen AS (
    SELECT name, vorig, voorvorig FROM jaren
    WHERE 1 = 1 [[AND name = {{werkjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
),
gtp_per_jaar AS (
    SELECT
        leden.organization_id,
        leden.`Werkjaar`,
        MAX(leden.organization_uri) AS groepsnummer,
        MAX(leden.`Eenheid`) AS eenheid,
        -- An eenheid is listed under the name and number it carries in the most recent of the three years.
        ROW_NUMBER() OVER (PARTITION BY leden.organization_id ORDER BY MIN(leden.period_start) DESC) AS recentste,
        -- @include gtp
            AS gtp
    FROM leden
    CROSS JOIN gekozen
    WHERE leden.`Werkjaar` IN (gekozen.name, gekozen.vorig, gekozen.voorvorig)
    GROUP BY leden.organization_id, leden.`Werkjaar`
),
per_eenheid AS (
    SELECT
        MAX(CASE WHEN gtp_per_jaar.recentste = 1 THEN gtp_per_jaar.groepsnummer END) AS groepsnummer,
        MAX(CASE WHEN gtp_per_jaar.recentste = 1 THEN gtp_per_jaar.eenheid END) AS eenheid,
        MAX(CASE WHEN gtp_per_jaar.`Werkjaar` = gekozen.voorvorig THEN gtp_per_jaar.gtp END) AS voorvorig,
        MAX(CASE WHEN gtp_per_jaar.`Werkjaar` = gekozen.vorig THEN gtp_per_jaar.gtp END) AS vorig,
        MAX(CASE WHEN gtp_per_jaar.`Werkjaar` = gekozen.name THEN gtp_per_jaar.gtp END) AS huidig
    FROM gtp_per_jaar
    CROSS JOIN gekozen
    GROUP BY gtp_per_jaar.organization_id
    HAVING MAX(gtp_per_jaar.`Werkjaar` = gekozen.name) = 1
)
SELECT
    groepsnummer AS `Groepsnummer`,
    eenheid AS `Eenheid`,
    voorvorig AS `GTP twee werkjaren eerder`,
    vorig AS `GTP vorig werkjaar`,
    huidig AS `GTP dit werkjaar`,
    CASE
        WHEN huidig < 55 AND huidig <= voorvorig - 10 THEN 'Onder 55 en gedaald'
        WHEN huidig < 55 THEN 'Onder 55'
        WHEN huidig <= voorvorig - 10 THEN 'Gedaald'
    END AS `Opvolgen`
FROM per_eenheid
-- Numeric groepsnummers in numeric order, then the others alphabetically.
ORDER BY
    groepsnummer NOT REGEXP '^[0-9]+$',
    CASE WHEN groepsnummer REGEXP '^[0-9]+$' THEN CAST(groepsnummer AS UNSIGNED) END,
    groepsnummer
