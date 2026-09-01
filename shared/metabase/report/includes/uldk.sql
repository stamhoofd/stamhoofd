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
