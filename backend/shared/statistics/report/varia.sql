-- @tab varia
-- title: Varia
-- description: Kinderen en leiding per eenheid, uitgesplitst naar geslacht.
-- filters: scoutsjaar

-- @card uldk
-- title: ULDK
-- display: table
-- size: full
-- @include facts
SELECT
    `Eenheid` AS `Name`,
    eenheid_gemeente AS `City`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' AND `Geslacht` = 'Man' THEN member_id END) AS `Aantal kinderen/Man`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' AND `Geslacht` = 'Vrouw' THEN member_id END) AS `Aantal kinderen/Vrouw`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' AND `Geslacht` = 'Andere' THEN member_id END) AS `Aantal kinderen/Andere`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' AND `Geslacht` = 'Onbekend' THEN member_id END) AS `Aantal kinderen/Onbekend`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' AND `Geslacht` = 'Man' THEN member_id END) AS `Aantal leiding/Man`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' AND `Geslacht` = 'Vrouw' THEN member_id END) AS `Aantal leiding/Vrouw`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' AND `Geslacht` = 'Andere' THEN member_id END) AS `Aantal leiding/Andere`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' AND `Geslacht` = 'Onbekend' THEN member_id END) AS `Aantal leiding/Onbekend`
FROM facts
GROUP BY `Eenheid`, eenheid_gemeente
ORDER BY `Eenheid`
