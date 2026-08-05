-- The ULDK figures per eenheid: the kinderen and the leiding of every eenheid split by geslacht, one
-- row per eenheid.
--
-- Shared because the totals under the table are the same figures added up. Counted again in a query
-- of their own they would be a second reading of the same thing, and a total that is not the sum of
-- the column above it reads as a mistake in either of the two.
--
-- Belongs after `leden`.
, uldk AS (
    SELECT
        `Eenheid` AS `Name`,
        eenheid_gemeente AS `City`,
        COUNT(DISTINCT CASE WHEN effective_category = 'child' AND `Geslacht` = 'Man' THEN member_id END) AS `Aantal kinderen/Man`,
        COUNT(DISTINCT CASE WHEN effective_category = 'child' AND `Geslacht` = 'Vrouw' THEN member_id END) AS `Aantal kinderen/Vrouw`,
        COUNT(DISTINCT CASE WHEN effective_category = 'child' AND `Geslacht` = 'Andere' THEN member_id END) AS `Aantal kinderen/Andere`,
        COUNT(DISTINCT CASE WHEN effective_category = 'child' AND `Geslacht` = 'Onbekend' THEN member_id END) AS `Aantal kinderen/Onbekend`,
        COUNT(DISTINCT CASE WHEN effective_category = 'leader' AND `Geslacht` = 'Man' THEN member_id END) AS `Aantal leiding/Man`,
        COUNT(DISTINCT CASE WHEN effective_category = 'leader' AND `Geslacht` = 'Vrouw' THEN member_id END) AS `Aantal leiding/Vrouw`,
        COUNT(DISTINCT CASE WHEN effective_category = 'leader' AND `Geslacht` = 'Andere' THEN member_id END) AS `Aantal leiding/Andere`,
        COUNT(DISTINCT CASE WHEN effective_category = 'leader' AND `Geslacht` = 'Onbekend' THEN member_id END) AS `Aantal leiding/Onbekend`
    FROM leden
    GROUP BY `Eenheid`, eenheid_gemeente
)
