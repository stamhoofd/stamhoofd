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
-- Elke eenheid houdt een eigen periode-rij voor hetzelfde jaar, dus hier staan alle rijen: precies de
-- namen waarop de rapporten groeperen. Gegroepeerd in plaats van opgesomd, want de filter zoekt op de
-- naam en een jaar zou anders meermaals in de lijst staan.
--
-- Nieuwste jaar eerst. Metabase sorteert een keuzelijst die uit een vraag komt zelf alfabetisch; de
-- CLI neemt deze volgorde daarom over in een vaste lijst.
SELECT name AS `Scoutsjaar`
FROM registration_periods
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
