-- @tab nationaal
-- title: Nationaal
-- description: Ledenaantallen over het hele platform voor het gekozen scoutsjaar.
-- filters: scoutsjaar

-- @card aantal-eenheden
-- title: Aantal eenheden
-- display: scalar
-- size: fifth
-- @include facts
SELECT COUNT(DISTINCT organization_id) AS `Aantal eenheden` FROM facts

-- @card totaal-leden
-- title: Totaal leden
-- display: scalar
-- size: fifth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Totaal leden` FROM facts

-- @card aantal-kinderen
-- title: Aantal kinderen
-- display: scalar
-- size: fifth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal kinderen` FROM facts WHERE categorie = 'child'

-- @card aantal-leiding
-- title: Aantal leiding
-- display: scalar
-- size: fifth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal leiding` FROM facts WHERE categorie = 'leader'

-- @card aantal-volwassenen
-- title: Aantal volwassenen
-- display: scalar
-- size: fifth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal volwassenen` FROM facts WHERE categorie = 'adult'

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
-- @include facts
SELECT
    `Eenheid`,
    COUNT(DISTINCT member_id) AS `Aantal leden`,
    -- @include gtp
        AS `GTP index`
FROM facts
GROUP BY `Eenheid`
ORDER BY `Aantal leden` DESC

-- @card leden-per-tak-vergelijking
-- title: Vergelijking aantal leden per tak met vorig scoutsjaar
-- display: bar
-- size: half
-- dimensions: Tak
-- metrics: Aantal leden dit jaar, Aantal leden vorig jaar
-- xlabels: rotate-45
-- @include facts-alle-jaren
-- Zie `includes/jaren.sql`: het scoutsjaar is de naam, niet het id. Hier tellen ook de jaren zonder
-- leden mee, want een vergelijking met een leeg jaar is nog steeds een geldige vergelijking.
, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LAG(name) OVER (ORDER BY MIN(startDate)) AS vorig
    FROM registration_periods
    GROUP BY name
)
-- The selected year, or the most recent one when the filter is empty, plus the year before it.
, gekozen AS (
    SELECT name, vorig FROM jaren
    WHERE 1 = 1 [[AND name = {{scoutsjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
SELECT
    f.`Tak`,
    COUNT(DISTINCT CASE WHEN f.`Scoutsjaar` = g.name THEN f.member_id END) AS `Aantal leden dit jaar`,
    COUNT(DISTINCT CASE WHEN f.`Scoutsjaar` = g.vorig THEN f.member_id END) AS `Aantal leden vorig jaar`
FROM facts f
CROSS JOIN gekozen g
WHERE f.`Scoutsjaar` IN (g.name, g.vorig)
GROUP BY f.`Tak`
ORDER BY MIN(COALESCE(f.tak_min_age, 99)), f.`Tak`

-- @card leden-per-geslacht
-- title: Aantal leden per geslacht
-- display: pie
-- size: half
-- dimensions: Geslacht
-- metrics: Aantal leden
WITH filteredMembers AS (
    SELECT
        r.memberId AS member_id,
        CASE m.gender
            WHEN 'Male' THEN 'Man'
            WHEN 'Female' THEN 'Vrouw'
            WHEN 'Other' THEN 'Andere'
            ELSE 'Onbekend'
        END AS `Geslacht`
    FROM members m
	INNER JOIN registrations r ON r.memberId = m.id
	INNER JOIN registration_periods p ON p.id = m.periodId
    INNER JOIN organizations o ON o.id = r.organizationId
    WHERE r.deactivatedAt IS NULL
      AND r.registeredAt IS NOT NULL
      [[AND p.name = {{scoutsjaar}}]]
      [[AND o.name = {{eenheid}}]]
)
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal leden`
FROM filteredMembers
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
-- @include facts
-- @include postcode-coordinaten
SELECT
    f.postcode AS `Postcode`,
    c.latitude AS `Breedtegraad`,
    c.longitude AS `Lengtegraad`,
    COUNT(DISTINCT f.member_id) AS `Aantal leden`
FROM facts f
LEFT JOIN postcode_coordinaten c ON c.postalCode = f.postcode
GROUP BY f.postcode, c.latitude, c.longitude
ORDER BY `Aantal leden` DESC

-- @card leden-per-geboortejaar
-- title: Aantal leden per geboortejaar
-- display: bar
-- size: half
-- dimensions: Geboortejaar
-- metrics: Aantal kinderen, Aantal leiding, Aantal volwassenen
-- @include facts
SELECT
    YEAR(birth_date) AS `Geboortejaar`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN categorie = 'adult' THEN member_id END) AS `Aantal volwassenen`
FROM facts
WHERE birth_date IS NOT NULL
GROUP BY YEAR(birth_date)
ORDER BY `Geboortejaar`

-- @card leden-per-type-lidgeld
-- title: Aantal leden per type lidgeld
-- display: pie
-- size: half
-- dimensions: Type lidgeld
-- metrics: Aantal leden
-- @include facts
SELECT
    mt.name AS `Type lidgeld`,
    COUNT(DISTINCT mpm.memberId) AS `Aantal leden`
FROM member_platform_memberships mpm
JOIN platform_membership_types mt ON mt.id = mpm.membershipTypeId
WHERE mpm.deletedAt IS NULL
  AND mpm.periodId IN (SELECT DISTINCT period_id FROM facts)
  AND mpm.memberId IN (SELECT DISTINCT member_id FROM facts)
GROUP BY mt.name
ORDER BY `Aantal leden` DESC

-- @card leden-per-scoutsjaar
-- title: Aantal leden per scoutsjaar
-- display: line
-- size: full
-- dimensions: Scoutsjaar
-- metrics: Totaal leden, Aantal kinderen, Aantal leiding, Aantal volwassenen
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    COUNT(DISTINCT member_id) AS `Totaal leden`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN categorie = 'adult' THEN member_id END) AS `Aantal volwassenen`
FROM facts
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card percentage-blijvers-per-eenheid
-- title: Overzicht percentage blijvers
-- display: bar
-- size: full
-- dimensions: Eenheid
-- metrics: Percentage blijvers
-- xlabels: rotate-90
-- description: Van de leden in het scoutsjaar voor het gekozen scoutsjaar, het percentage dat in het gekozen scoutsjaar nog lid is, per eenheid waar ze toen zaten. Links = laagste ledenbehoud.
-- Rechtop, om dezelfde reden als bij de grafiek met het aantal leden per eenheid.
-- @include facts-alle-jaren
-- @include leden-per-jaar
-- @include jaren
, gekozen AS (
    SELECT name, vorig FROM jaren
    WHERE vorig IS NOT NULL [[AND name = {{scoutsjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
-- Een blijver is lid in het jaar voor het gekozen jaar en nog steeds lid in het gekozen jaar, waar
-- ook op het platform: wie naar een andere eenheid verhuist telt mee, zoals de klant het ook rekent.
SELECT
    vorig.`Eenheid`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT vorig.member_id), 1) AS `Percentage blijvers`
FROM gekozen g
JOIN facts vorig ON vorig.`Scoutsjaar` = g.vorig
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Scoutsjaar` = g.name
    AND gebleven.member_id = vorig.member_id
GROUP BY vorig.`Eenheid`
ORDER BY `Percentage blijvers`
