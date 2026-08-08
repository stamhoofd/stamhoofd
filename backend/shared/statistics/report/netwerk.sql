-- @tab netwerk
-- title: Netwerk
-- description: Leden en eenheden per netwerk voor het gekozen scoutsjaar.
-- filters: scoutsjaar
--
-- Het netwerk van een eenheid is een tag op de organisatie, bijgehouden per periode: een afgesloten
-- jaar houdt het netwerk waarmee het toen geregistreerd stond.

-- @card leden-per-netwerk
-- title: Aantal leden per netwerk
-- display: bar
-- size: half
-- dimensions: Netwerk
-- metrics: Aantal kinderen, Aantal leiding, Aantal volwassenen
-- stacked: stacked
-- @include facts
SELECT
    t.name AS `Netwerk`,
    COUNT(DISTINCT CASE WHEN f.categorie = 'child' THEN f.member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN f.categorie = 'leader' THEN f.member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN f.categorie = 'adult' THEN f.member_id END) AS `Aantal volwassenen`
FROM facts f
JOIN _organizations_organization_tags link
    ON link.organizationsId = f.organization_id AND link.periodId = f.period_id
JOIN organization_tags t ON t.id = link.organizationTagsId
GROUP BY t.name
ORDER BY t.name

-- @card eenheden-per-netwerk
-- title: Aantal eenheden per netwerk
-- display: pie
-- size: half
-- dimensions: Netwerk
-- metrics: Aantal eenheden
-- @include facts
SELECT
    t.name AS `Netwerk`,
    COUNT(DISTINCT f.organization_id) AS `Aantal eenheden`
FROM facts f
JOIN _organizations_organization_tags link
    ON link.organizationsId = f.organization_id AND link.periodId = f.period_id
JOIN organization_tags t ON t.id = link.organizationTagsId
GROUP BY t.name
ORDER BY t.name

-- @card locatie-eenheden
-- title: Locatie eenheden
-- display: table
-- size: full
-- description: De kaart uit het originele rapport vraagt coordinaten per eenheid; die staan niet in de statistiekendatabank.
-- @include facts
SELECT
    f.`Eenheid`,
    f.eenheid_postcode AS `Postcode`,
    f.eenheid_gemeente AS `Gemeente`,
    COALESCE(t.name, 'Geen netwerk') AS `Netwerk`,
    COUNT(DISTINCT f.member_id) AS `Aantal leden`
FROM facts f
LEFT JOIN _organizations_organization_tags link
    ON link.organizationsId = f.organization_id AND link.periodId = f.period_id
LEFT JOIN organization_tags t ON t.id = link.organizationTagsId
GROUP BY f.`Eenheid`, f.eenheid_postcode, f.eenheid_gemeente, t.name
ORDER BY f.`Eenheid`
