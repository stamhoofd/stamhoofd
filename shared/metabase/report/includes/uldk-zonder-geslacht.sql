-- description: De ULDK-tabel zonder de geslachten: kinderen en leiding per eenheid, voor een platform dat zijn leden geen geslacht vraagt.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    `Eenheid` AS `Name`,
    eenheid_gemeente AS `City`,
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`
FROM leden
GROUP BY `Eenheid`, eenheid_gemeente
