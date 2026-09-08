-- @tab varia
-- title: Varia
-- description: Kinderen en leiding per eenheid, uitgesplitst naar geslacht.
-- description@keeo: Kinderen en leiding per eenheid.
-- filters: werkjaar, platformleden_opnemen
-- required: werkjaar

-- De ULDK-tabel staat er in twee vormen, met en zonder de geslachten. Elke omgeving schrijft er
-- precies één paar van: uitsplitsen naar geslacht is wat een platform dat er geen vraagt niet kan.
-- @card uldk
-- title: ULDK
-- except: keeo
-- display: table
-- size: full
-- De tabel is het fragment zelf, enkel gesorteerd: wie het los van de kaart wil bekijken, opent de
-- snippet en draait ze zoals ze is.
SELECT * FROM (
    -- @include uldk
) uldk
ORDER BY `Name`

-- @card uldk-totaal
-- title: ULDK (totaal)
-- except: keeo
-- display: table
-- size: full
-- height: 4
-- description: De som van de kolommen in de tabel hierboven. Staat in een eigen kaart omdat een tabel in Metabase enkel rijen bovenaan kan vastzetten: als laatste rij van de tabel zou het totaal pas na het doorscrollen van alle eenheden te zien zijn.
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
FROM (
    -- @include uldk
) uldk

-- @card uldk-zonder-geslacht
-- title: ULDK
-- only: keeo
-- display: table
-- size: full
SELECT * FROM (
    -- @include uldk-zonder-geslacht
) uldk
ORDER BY `Name`

-- @card uldk-zonder-geslacht-totaal
-- title: ULDK (totaal)
-- only: keeo
-- display: table
-- size: full
-- height: 4
-- description: De som van de kolommen in de tabel hierboven. Staat in een eigen kaart omdat een tabel in Metabase enkel rijen bovenaan kan vastzetten: als laatste rij van de tabel zou het totaal pas na het doorscrollen van alle eenheden te zien zijn.
SELECT
    'Totaal' AS `Name`,
    '' AS `City`,
    COALESCE(SUM(`Aantal kinderen`), 0) AS `Aantal kinderen`,
    COALESCE(SUM(`Aantal leiding`), 0) AS `Aantal leiding`
FROM (
    -- @include uldk-zonder-geslacht
) uldk
