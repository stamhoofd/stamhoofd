-- @tab netwerk
-- title: Netwerk
-- description: Leden en eenheden per netwerk voor het gekozen werkjaar.
-- filters: werkjaar, platformleden_opnemen
-- required: werkjaar
--
-- Het netwerk van een eenheid is een tag op de organisatie, bijgehouden per periode: een afgesloten
-- jaar houdt het netwerk waarmee het toen geregistreerd stond.

-- @card leden-per-netwerk
-- title: Aantal leden per netwerk
-- display: bar
-- size: half
-- height: 10
-- dimensions: Netwerk
-- metrics: Aantal kinderen, Aantal leiding, Aantal volwassenen
-- stacked: stacked
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    organization_tags.name AS `Netwerk`,
    COUNT(DISTINCT CASE WHEN leden.effective_category = 'child' THEN leden.member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN leden.effective_category = 'leader' THEN leden.member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN leden.effective_category = 'adult' THEN leden.member_id END) AS `Aantal volwassenen`
FROM leden
JOIN _organizations_organization_tags
    ON _organizations_organization_tags.organizationsId = leden.organization_id
    AND _organizations_organization_tags.periodId = leden.period_id
JOIN organization_tags
    ON organization_tags.id = _organizations_organization_tags.organizationTagsId
    AND organization_tags.periodId = _organizations_organization_tags.periodId
GROUP BY organization_tags.name
ORDER BY organization_tags.name

-- @card locatie-eenheden
-- title: Locatie eenheden
-- display: map
-- latitude: Breedtegraad
-- longitude: Lengtegraad
-- size: half
-- span: 2
-- dimensions: Postcode
-- metrics: Aantal eenheden
-- description: Een punt per postcode waar eenheden zitten. Het originele rapport zet een stip per eenheid; zonder coordinaat per eenheid is de postcode het dichtstbij.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
),
postcode_coordinaten AS (
    -- @include postal-code-coordinates
)
SELECT
    leden.eenheid_postcode AS `Postcode`,
    postcode_coordinaten.latitude AS `Breedtegraad`,
    postcode_coordinaten.longitude AS `Lengtegraad`,
    COUNT(DISTINCT leden.organization_id) AS `Aantal eenheden`
FROM leden
LEFT JOIN postcode_coordinaten ON postcode_coordinaten.postalCode = leden.eenheid_postcode
GROUP BY leden.eenheid_postcode, postcode_coordinaten.latitude, postcode_coordinaten.longitude
ORDER BY `Aantal eenheden` DESC

-- @card eenheden-per-netwerk
-- title: Aantal eenheden per netwerk
-- display: pie
-- size: half
-- dimensions: Netwerk
-- metrics: Aantal eenheden
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    organization_tags.name AS `Netwerk`,
    COUNT(DISTINCT leden.organization_id) AS `Aantal eenheden`
FROM leden
JOIN _organizations_organization_tags
    ON _organizations_organization_tags.organizationsId = leden.organization_id
    AND _organizations_organization_tags.periodId = leden.period_id
JOIN organization_tags
    ON organization_tags.id = _organizations_organization_tags.organizationTagsId
    AND organization_tags.periodId = _organizations_organization_tags.periodId
GROUP BY organization_tags.name
ORDER BY organization_tags.name
