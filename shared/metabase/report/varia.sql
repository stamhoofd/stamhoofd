-- @tab varia
-- title: Varia
-- description: Kinderen en leiding per eenheid, uitgesplitst naar geslacht.
-- filters: scoutsjaar, aansluiting

-- @card uldk
-- title: ULDK
-- display: table
-- size: full
-- @include facts
-- @include leden
-- @include uldk
SELECT * FROM uldk ORDER BY `Name`

-- @card uldk-totaal
-- title: ULDK (totaal)
-- display: table
-- size: full
-- height: 4
-- description: De som van de kolommen in de tabel hierboven. Staat in een eigen kaart omdat een tabel in Metabase enkel rijen bovenaan kan vastzetten: als laatste rij van de tabel zou het totaal pas na het doorscrollen van alle eenheden te zien zijn.
-- @include facts
-- @include leden
-- @include uldk
SELECT
    'Totaal' AS `Name`,
    '' AS `City`,
    COALESCE(SUM(`Aantal kinderen/Man`), 0) AS `Aantal kinderen/Man`,
    COALESCE(SUM(`Aantal kinderen/Vrouw`), 0) AS `Aantal kinderen/Vrouw`,
    COALESCE(SUM(`Aantal kinderen/Andere`), 0) AS `Aantal kinderen/Andere`,
    COALESCE(SUM(`Aantal kinderen/Onbekend`), 0) AS `Aantal kinderen/Onbekend`,
    COALESCE(SUM(`Aantal leiding/Man`), 0) AS `Aantal leiding/Man`,
    COALESCE(SUM(`Aantal leiding/Vrouw`), 0) AS `Aantal leiding/Vrouw`,
    COALESCE(SUM(`Aantal leiding/Andere`), 0) AS `Aantal leiding/Andere`,
    COALESCE(SUM(`Aantal leiding/Onbekend`), 0) AS `Aantal leiding/Onbekend`
FROM uldk
