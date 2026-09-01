-- @tab nationaal
-- title: Nationaal
-- description: Ledenaantallen over het hele platform voor het gekozen werkjaar.
-- filters: werkjaar, platformleden_opnemen
-- required: werkjaar

-- @card aantal-eenheden
-- title: Aantal eenheden
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT organization_id) AS `Aantal eenheden` FROM leden

-- @card totaal-leden
-- title: Totaal leden
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Totaal leden` FROM leden

-- @card aantal-kinderen
-- title: Aantal kinderen
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Aantal kinderen` FROM leden WHERE effective_category = 'child'

-- @card aantal-leiding
-- title: Aantal leiding
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Aantal leiding` FROM leden WHERE effective_category = 'leader'

-- @card aantal-volwassenen
-- title: Aantal volwassenen
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Aantal volwassenen` FROM leden WHERE effective_category = 'adult'

-- @card leden-per-eenheid
-- title: Aantal leden per eenheid & GTP index per eenheid
-- display: combo
-- size: full
-- dimensions: Eenheid
-- metrics: Aantal leden, GTP index
-- xlabels: rotate-90
-- description: GTP staat voor Gezond Toekomst Perspectief. Idealiter scoort een eenheid 100 of meer.
-- Rechtop, niet schuin: Metabase laat een label vallen zodra het het vorige raakt, en schuin heeft
-- een naam per eenheid daar net te weinig plaats voor.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    `Eenheid`,
    COUNT(DISTINCT member_id) AS `Aantal leden`,
    -- @include gtp
        AS `GTP index`
FROM leden
GROUP BY `Eenheid`
ORDER BY `Aantal leden` DESC

-- @card leden-per-leeftijdsgroep-vergelijking
-- title: Vergelijking aantal leden per leeftijdsgroep met vorig werkjaar
-- display: bar
-- size: half
-- dimensions: Leeftijdsgroep
-- metrics: Aantal leden dit jaar, Aantal leden vorig jaar
-- xlabels: rotate-45
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
),
-- Zie `includes/years-with-members.sql`: het werkjaar is de naam, niet het id. Hier tellen ook de jaren zonder
-- leden mee, want een vergelijking met een leeg jaar is nog steeds een geldige vergelijking.
jaren AS (
    SELECT name, MIN(startDate) AS startDate, LAG(name) OVER (ORDER BY MIN(startDate)) AS vorig
    FROM registration_periods
    GROUP BY name
),
-- The selected year, or the most recent one when the filter is empty, plus the year before it.
gekozen AS (
    SELECT name, vorig FROM jaren
    WHERE 1 = 1 [[AND name = {{werkjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
SELECT
    leden.`Leeftijdsgroep`,
    COUNT(DISTINCT CASE WHEN leden.`Werkjaar` = gekozen.name THEN leden.member_id END) AS `Aantal leden dit jaar`,
    COUNT(DISTINCT CASE WHEN leden.`Werkjaar` = gekozen.vorig THEN leden.member_id END) AS `Aantal leden vorig jaar`
FROM leden
CROSS JOIN gekozen
WHERE leden.`Werkjaar` IN (gekozen.name, gekozen.vorig)
GROUP BY leden.`Leeftijdsgroep`
ORDER BY MIN(COALESCE(leden.age_group_min_age, 99)), leden.`Leeftijdsgroep`

-- @card leden-per-geslacht
-- title: Aantal leden per geslacht
-- display: pie
-- size: half
-- dimensions: Geslacht
-- metrics: Aantal leden
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal leden`
FROM leden
GROUP BY `Geslacht`
ORDER BY `Aantal leden` DESC

-- @card leden-per-postcode
-- title: Aantal leden per postcode
-- display: map
-- latitude: Breedtegraad
-- longitude: Lengtegraad
-- size: full
-- dimensions: Postcode
-- metrics: Aantal leden
-- description: Een punt per postcode. Een postcode zonder coordinaat in `postal_codes` telt wel mee, maar staat niet op de kaart.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
),
postcode_coordinaten AS (
    -- @include postal-code-coordinates
)
SELECT
    leden.postcode AS `Postcode`,
    postcode_coordinaten.latitude AS `Breedtegraad`,
    postcode_coordinaten.longitude AS `Lengtegraad`,
    COUNT(DISTINCT leden.member_id) AS `Aantal leden`
FROM leden
LEFT JOIN postcode_coordinaten ON postcode_coordinaten.postalCode = leden.postcode
GROUP BY leden.postcode, postcode_coordinaten.latitude, postcode_coordinaten.longitude
ORDER BY `Aantal leden` DESC

-- @card leden-per-geboortejaar
-- title: Aantal leden per geboortejaar
-- display: bar
-- size: half
-- dimensions: Geboortejaar
-- metrics: Aantal kinderen, Aantal leiding, Aantal volwassenen
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    YEAR(birth_date) AS `Geboortejaar`,
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN effective_category = 'adult' THEN member_id END) AS `Aantal volwassenen`
FROM leden
WHERE birth_date IS NOT NULL
GROUP BY YEAR(birth_date)
ORDER BY `Geboortejaar`

-- @card leden-per-type-lidgeld
-- title: Aantal leden per type lidgeld
-- display: pie
-- size: half
-- dimensions: Type lidgeld
-- metrics: Aantal leden
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    -- @include membership-fee-type
        AS `Type lidgeld`,
    COUNT(DISTINCT member_platform_memberships.memberId) AS `Aantal leden`
FROM member_platform_memberships
-- Het lidgeld van een lid in het jaar waarin het lid was, als één join op het paar. Niet als een
-- IN-subquery per kolom: `leden` wordt dan per subquery opnieuw opgebouwd en MySQL hasht die twee
-- resultaten tegen elkaar, waarmee de kaart niet meer laadt. Het paar is meteen ook wat de kaart
-- telt -- een lidgeld uit een jaar waarin dat lid geen lid was, hoort er niet bij.
JOIN (SELECT DISTINCT member_id, period_id FROM leden) leden_periodes
    ON leden_periodes.member_id = member_platform_memberships.memberId
    AND leden_periodes.period_id = member_platform_memberships.periodId
WHERE member_platform_memberships.deletedAt IS NULL
  -- Geen lidmaatschap bij de koepel zelf zolang de dashboardfilter die organisatie weglaat.
  AND (
      {{platformleden_opnemen}}
      OR NOT EXISTS (SELECT 1 FROM platform WHERE platform.membershipOrganizationId = member_platform_memberships.organizationId)
  )
  AND (
      -- @include filter-statistics-memberships
  )
GROUP BY member_platform_memberships.reducedPrice
ORDER BY `Aantal leden` DESC

-- @card leden-per-werkjaar
-- title: Aantal leden per werkjaar
-- display: line
-- size: full
-- dimensions: Werkjaar
-- metrics: Totaal leden, Aantal kinderen, Aantal leiding, Aantal volwassenen
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    COUNT(DISTINCT member_id) AS `Totaal leden`,
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN effective_category = 'adult' THEN member_id END) AS `Aantal volwassenen`
FROM leden
GROUP BY `Werkjaar`
ORDER BY MIN(period_start)

-- @card percentage-blijvers-per-eenheid
-- title: Overzicht percentage blijvers
-- display: bar
-- size: full
-- dimensions: Eenheid
-- metrics: Percentage blijvers
-- xlabels: rotate-90
-- description: Van de leden in het gekozen werkjaar, het percentage dat het werkjaar erna nog lid is, per eenheid waar ze in het gekozen jaar zaten. Links = laagste ledenbehoud. Het laatste werkjaar staat er niet bij: het jaar erna moet eerst bestaan.
-- Rechtop, om dezelfde reden als bij de grafiek met het aantal leden per eenheid.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
),
leden_per_jaar AS (
    -- @include members-per-year
),
jaren AS (
    -- @include years-with-members
),
gekozen AS (
    SELECT name, volgend FROM jaren
    WHERE volgend IS NOT NULL [[AND name = {{werkjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
-- Een blijver is lid in het gekozen jaar en nog steeds lid het jaar erna, waar ook op het platform:
-- wie naar een andere eenheid verhuist telt mee, zoals de klant het ook rekent.
SELECT
    huidig.`Eenheid`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM gekozen
JOIN leden huidig ON huidig.`Werkjaar` = gekozen.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Werkjaar` = gekozen.volgend
    AND gebleven.member_id = huidig.member_id
GROUP BY huidig.`Eenheid`
ORDER BY `Percentage blijvers`
