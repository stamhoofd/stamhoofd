-- @tab filters
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

-- @card aansluiting
-- title: Aansluitingen
-- display: table
-- size: half
-- Eén rij per type per scoutsjaar, dus gegroepeerd op de naam: de filter zoekt op de naam en een type
-- zou anders eenmaal per jaar in de lijst staan.
SELECT name AS `Aansluiting`
FROM platform_membership_types
GROUP BY name
ORDER BY name

-- @card eenheid
-- title: Eenheden
-- display: table
-- size: half
-- Zonder de eigen organisatie van de koepel: de dashboards tellen die nergens mee, dus als filter zou
-- ze elke kaart op nul zetten.
SELECT o.name AS `Eenheid`
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = o.id)
GROUP BY o.name
ORDER BY o.name

-- @card ingeschreven-voor
-- title: Ingeschreven voor
-- display: table
-- size: half
-- De drie soorten inschrijving die `includes/ingeschreven-voor.sql` kent, in de woorden waarin die ze
-- benoemt. Ze staan in geen enkele tabel: een groep houdt haar soort als 'Membership',
-- 'EventRegistration' of 'WaitingList' bij, en dat zijn geen woorden die dit rapport ergens toont.
-- Vandaar hier een vaste lijst, die alleen kan wijzigen als er een soort bijkomt.
--
-- Leeftijdsgroepen eerst, want daarop staat de filter standaard; daarna wat een lezer erbij kan
-- vragen. Metabase sorteert een keuzelijst uit een vraag zelf alfabetisch, dus de CLI neemt deze
-- volgorde over in een vaste lijst -- en een UNION zonder ORDER BY belooft geen volgorde, vandaar de
-- kolom waarop gesorteerd wordt.
SELECT `Ingeschreven voor` FROM (
    SELECT 1 AS volgorde, 'Leeftijdsgroepen' AS `Ingeschreven voor`
    UNION ALL SELECT 2, 'Activiteiten'
    UNION ALL SELECT 3, 'Wachtlijsten'
) opties
ORDER BY volgorde
