-- @tab nationaal
-- title: Nationaal
-- description: Ledenaantallen over het hele platform voor het gekozen scoutsjaar.
-- filters: scoutsjaar, aansluiting

-- @card aantal-eenheden
-- title: Aantal eenheden
-- display: scalar
-- size: sixth
-- @include facts
SELECT COUNT(DISTINCT organization_id) AS `Aantal eenheden` FROM facts

-- @card totaal-leden
-- title: Totaal leden
-- display: scalar
-- size: sixth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Totaal leden` FROM facts

-- @card aantal-kinderen
-- title: Aantal kinderen
-- display: scalar
-- size: sixth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal kinderen` FROM facts WHERE effective_category = 'child'

-- @card aantal-leiding
-- title: Aantal leiding
-- display: scalar
-- size: sixth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal leiding` FROM facts WHERE effective_category = 'leader'

-- @card aantal-volwassenen
-- title: Aantal volwassenen
-- display: scalar
-- size: sixth
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal volwassenen` FROM facts WHERE effective_category = 'adult'

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
-- @include gtp-leden
SELECT
    `Eenheid`,
    COUNT(DISTINCT member_id) AS `Aantal leden`,
    -- @include gtp
        AS `GTP index`
FROM gtp_leden
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
	-- Op hetzelfde jaar, niet alleen op het lid: zonder dat telt elke inschrijving van dat lid mee,
	-- ook die uit een ander scoutsjaar dan het jaar waar deze rij over gaat.
	INNER JOIN registrations r ON r.memberId = m.id AND r.periodId = m.periodId
	INNER JOIN registration_periods p ON p.id = m.periodId
    INNER JOIN organizations o ON o.id = r.organizationId AND o.periodId = r.periodId
    WHERE r.deactivatedAt IS NULL
      AND r.registeredAt IS NOT NULL
      -- Niet de koepel zelf, net zoals in `facts`: deze kaart telt de leden zelf op en zou hem
      -- anders als enige kaart van de pagina wel meetellen.
      AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = r.organizationId)
      [[AND p.name = {{scoutsjaar}}]]
      [[AND o.name = {{eenheid}}]]
      -- @include aansluiting
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
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN effective_category = 'adult' THEN member_id END) AS `Aantal volwassenen`
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
    -- @include tarief
        AS `Type lidgeld`,
    COUNT(DISTINCT mpm.memberId) AS `Aantal leden`
FROM member_platform_memberships mpm
-- Enkel nog om op de aansluiting te kunnen filteren: waar de taart op splitst is het tarief, en dat
-- staat op het lidgeld zelf.
JOIN platform_membership_types mt ON mt.id = mpm.membershipTypeId AND mt.periodId = mpm.periodId
WHERE mpm.deletedAt IS NULL
  AND mpm.periodId IN (SELECT DISTINCT period_id FROM facts)
  AND mpm.memberId IN (SELECT DISTINCT member_id FROM facts)
  -- Geen lidmaatschap bij de koepel zelf: `facts` laat die organisatie weg, en wie naast een eenheid
  -- ook in een nationale ploeg zit zou het tarief daarvan anders in deze grafiek zetten.
  AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = mpm.organizationId)
  -- Alleen de gekozen aansluitingen: `facts` houdt de leden over die er een van hebben, en zonder
  -- dit zou de taart daarnaast ook de andere aansluitingen van net die leden tonen.
  [[AND mt.name IN ({{aansluiting}})]]
GROUP BY mpm.reducedPrice
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
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN effective_category = 'adult' THEN member_id END) AS `Aantal volwassenen`
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
-- description: Van de leden in het gekozen scoutsjaar, het percentage dat het scoutsjaar erna nog lid is, per eenheid waar ze in het gekozen jaar zaten. Links = laagste ledenbehoud. Het laatste scoutsjaar staat er niet bij: het jaar erna moet eerst bestaan.
-- Rechtop, om dezelfde reden als bij de grafiek met het aantal leden per eenheid.
-- @include facts-alle-jaren
-- @include leden-per-jaar
-- @include jaren
, gekozen AS (
    SELECT name, volgend FROM jaren
    WHERE volgend IS NOT NULL [[AND name = {{scoutsjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
-- Een blijver is lid in het gekozen jaar en nog steeds lid het jaar erna, waar ook op het platform:
-- wie naar een andere eenheid verhuist telt mee, zoals de klant het ook rekent.
SELECT
    huidig.`Eenheid`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM gekozen g
JOIN facts huidig ON huidig.`Scoutsjaar` = g.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Scoutsjaar` = g.volgend
    AND gebleven.member_id = huidig.member_id
GROUP BY huidig.`Eenheid`
ORDER BY `Percentage blijvers`
