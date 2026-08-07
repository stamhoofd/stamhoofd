-- @dashboard filters
-- title: Filterwaarden
-- hidden: true
-- description: Deze vragen vullen de keuzelijsten van de filters bovenaan de dashboards. Ze staan zelf niet op een dashboard.
--
-- Elke kaart hier hoort bij een filter met dezelfde naam: de dashboardfilter `scoutsjaar` haalt zijn
-- waarden uit de kaart `scoutsjaar`.

-- @card scoutsjaar
-- title: Scoutsjaren
-- display: table
-- size: half
-- Grouped rather than listed: the filter matches on the label, so two periods sharing one would
-- otherwise show up twice in the dropdown and select both.
SELECT name AS `Scoutsjaar`
FROM registration_periods
WHERE organizationId IS NULL
GROUP BY name
ORDER BY MAX(startDate) DESC

-- @card eenheid
-- title: Eenheden
-- display: table
-- size: half
SELECT name AS `Eenheid`
FROM organizations
GROUP BY name
ORDER BY name
