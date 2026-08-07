-- @dashboard eenheden
-- title: Eenheden
-- description: Alles over een enkele eenheid. Kies een eenheid en een scoutsjaar bovenaan.
-- filters: scoutsjaar, eenheid

-- @card eenheid-totaal-leden
-- title: Totaal aantal leden
-- display: scalar
-- size: quarter
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Totaal aantal leden` FROM facts

-- @card eenheid-aantal-kinderen
-- title: Aantal kinderen
-- display: scalar
-- size: quarter
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal kinderen` FROM facts WHERE categorie = 'child'

-- @card eenheid-aantal-leiding
-- title: Aantal leiding
-- display: scalar
-- size: quarter
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal leiding` FROM facts WHERE categorie = 'leader'

-- @card eenheid-aantal-volwassenen
-- title: Aantal volwassenen
-- display: scalar
-- size: quarter
-- @include facts
SELECT COUNT(DISTINCT member_id) AS `Aantal volwassenen` FROM facts WHERE categorie = 'adult'

-- @card eenheid-gtp
-- title: GTP Index
-- display: gauge
-- size: half
-- description: GTP staat voor Gezond Toekomst Perspectief. Idealiter scoort een eenheid 100 of meer. Let op: dit is een voorlopige berekening, de formule van de klant is nog niet verwerkt.
-- @include facts
, gtp_basis AS (
    SELECT
        COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) AS kinderen,
        COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END) AS leiding,
        COUNT(DISTINCT CASE WHEN categorie = 'adult' THEN member_id END) AS volwassenen,
        COUNT(DISTINCT CASE WHEN categorie = 'child' AND tak_min_age >= 14 THEN member_id END) AS toekomstige_leiding
    FROM facts
)
SELECT
    -- @include gtp
        AS `GTP Index`
FROM gtp_basis gb

-- @card eenheid-omkaderingscijfer
-- title: Omkaderingscijfer
-- display: gauge
-- size: half
-- description: Het omkaderingscijfer geeft weer voor hoeveel leden een leider gemiddeld dient te zorgen. Idealiter scoort een eenheid hier laag op. Bij een cijfer van 10 of meer wordt toezicht houden op de leden moeilijker.
-- @include facts
SELECT ROUND(
    COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END)
    / NULLIF(COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END), 0), 2) AS `Omkaderingscijfer`
FROM facts

-- @card eenheid-leden-per-postcode
-- title: Aantal leden per postcode
-- display: bar
-- size: full
-- dimensions: Postcode
-- metrics: Aantal leden
-- @include facts
SELECT postcode AS `Postcode`, COUNT(DISTINCT member_id) AS `Aantal leden`
FROM facts
WHERE postcode IS NOT NULL
GROUP BY postcode
ORDER BY `Aantal leden` DESC

-- @card eenheid-leden-per-scoutsjaar
-- title: Aantal leden per scoutsjaar
-- display: line
-- size: full
-- dimensions: Scoutsjaar
-- metrics: Totaal leden, Aantal kinderen, Aantal leiding, Aantal volwassenen
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    COUNT(DISTINCT member_id) AS `Totaal leden`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN categorie = 'adult' THEN member_id END) AS `Aantal volwassenen`
FROM facts
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-gtp-per-scoutsjaar
-- title: GTP index per Scoutsjaar
-- display: line
-- size: half
-- dimensions: Scoutsjaar
-- metrics: GTP index
-- description: Voorlopige berekening, zie de opmerking in de query.
-- @include facts-alle-jaren
, gtp_basis AS (
    SELECT
        `Scoutsjaar`,
        MIN(period_start) AS period_start,
        COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) AS kinderen,
        COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END) AS leiding,
        COUNT(DISTINCT CASE WHEN categorie = 'adult' THEN member_id END) AS volwassenen,
        COUNT(DISTINCT CASE WHEN categorie = 'child' AND tak_min_age >= 14 THEN member_id END) AS toekomstige_leiding
    FROM facts
    GROUP BY `Scoutsjaar`
)
SELECT
    gb.`Scoutsjaar`,
    -- @include gtp
        AS `GTP index`
FROM gtp_basis gb
ORDER BY gb.period_start

-- @card eenheid-omkaderingscijfer-per-scoutsjaar
-- title: Omkaderingscijfer per Scoutsjaar
-- display: line
-- size: half
-- dimensions: Scoutsjaar
-- metrics: Omkaderingscijfer
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    ROUND(
        COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END), 0), 2) AS `Omkaderingscijfer`
FROM facts
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-leden-per-geslacht
-- title: Aantal leden per geslacht
-- display: pie
-- size: third
-- dimensions: Geslacht
-- metrics: Aantal leden
-- @include facts
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal leden`
FROM facts
GROUP BY `Geslacht`
ORDER BY `Aantal leden` DESC

-- @card eenheid-kinderen-per-geslacht
-- title: Aantal kinderen per geslacht
-- display: pie
-- size: third
-- dimensions: Geslacht
-- metrics: Aantal kinderen
-- @include facts
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM facts
WHERE categorie = 'child'
GROUP BY `Geslacht`
ORDER BY `Aantal kinderen` DESC

-- @card eenheid-leiding-per-geslacht
-- title: Aantal leiding per geslacht
-- display: pie
-- size: third
-- dimensions: Geslacht
-- metrics: Aantal leiding
-- @include facts
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal leiding`
FROM facts
WHERE categorie = 'leader'
GROUP BY `Geslacht`
ORDER BY `Aantal leiding` DESC

-- @card eenheid-leden-per-type-lidgeld
-- title: Aantal leden per type lidgeld
-- display: pie
-- size: half
-- dimensions: Type lidgeld
-- metrics: Aantal leden
-- @include facts
SELECT
    mt.name AS `Type lidgeld`,
    COUNT(DISTINCT mpm.memberId) AS `Aantal leden`
FROM member_platform_memberships mpm
JOIN platform_membership_types mt ON mt.id = mpm.membershipTypeId
WHERE mpm.deletedAt IS NULL
  AND mpm.periodId IN (SELECT DISTINCT period_id FROM facts)
  AND mpm.memberId IN (SELECT DISTINCT member_id FROM facts)
GROUP BY mt.name
ORDER BY `Aantal leden` DESC

-- @card eenheid-evolutie-per-tak
-- title: Evolutie ledenaantallen per tak
-- display: line
-- size: full
-- dimensions: Scoutsjaar, Tak
-- metrics: Aantal kinderen
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    `Tak`,
    COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM facts
WHERE categorie = 'child'
GROUP BY `Scoutsjaar`, `Tak`
ORDER BY MIN(period_start), `Tak`

-- @card eenheid-jong-versus-oud
-- title: Verhouding jongste versus oudste leden
-- display: bar
-- size: full
-- dimensions: Scoutsjaar
-- metrics: Jong, Oud
-- stacked: normalized
-- description: Jong zijn de takken tot en met 10 jaar, oud de takken vanaf 11 jaar. Het originele rapport benoemt de grens niet.
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    COUNT(DISTINCT CASE WHEN tak_max_age <= 10 THEN member_id END) AS `Jong`,
    COUNT(DISTINCT CASE WHEN tak_min_age >= 11 THEN member_id END) AS `Oud`
FROM facts
WHERE categorie = 'child'
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-geslacht-kinderen-per-jaar
-- title: Verhouding tussen de geslachten: kinderen
-- display: bar
-- size: half
-- dimensions: Scoutsjaar, Geslacht
-- metrics: Aantal kinderen
-- stacked: normalized
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM facts
WHERE categorie = 'child'
GROUP BY `Scoutsjaar`, `Geslacht`
ORDER BY MIN(period_start)

-- @card eenheid-geslacht-leiding-per-jaar
-- title: Verhouding tussen de geslachten: leiding
-- display: bar
-- size: half
-- dimensions: Scoutsjaar, Geslacht
-- metrics: Aantal leiding
-- stacked: normalized
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal leiding`
FROM facts
WHERE categorie = 'leader'
GROUP BY `Scoutsjaar`, `Geslacht`
ORDER BY MIN(period_start)

-- @card eenheid-leden-per-geboortejaar
-- title: Aantal leden en leiding per geboortejaar
-- display: bar
-- size: half
-- dimensions: Geboortejaar
-- metrics: Aantal kinderen, Aantal leiding
-- @include facts
SELECT
    YEAR(birth_date) AS `Geboortejaar`,
    COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END) AS `Aantal leiding`
FROM facts
WHERE birth_date IS NOT NULL
GROUP BY YEAR(birth_date)
ORDER BY `Geboortejaar`

-- @card eenheid-leeftijd-en-geslacht
-- title: Aantal leden per Leeftijd en Geslacht
-- display: bar
-- size: half
-- dimensions: Leeftijd, Geslacht
-- metrics: Aantal leden
-- @include facts
SELECT
    leeftijd AS `Leeftijd`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal leden`
FROM facts
WHERE birth_date IS NOT NULL
GROUP BY leeftijd, `Geslacht`
ORDER BY leeftijd

-- @card eenheid-gemiddelde-leeftijd-leiding
-- title: Gemiddelde leeftijd leiding per Scoutsjaar
-- display: line
-- size: full
-- dimensions: Scoutsjaar
-- metrics: Gemiddelde leeftijd leiding
-- @include facts-alle-jaren
SELECT
    `Scoutsjaar`,
    ROUND(AVG(leeftijd), 1) AS `Gemiddelde leeftijd leiding`
FROM facts
WHERE categorie = 'leader' AND birth_date IS NOT NULL
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-ledenbehoud
-- title: Ledenbehoud: blijvers & vertrekkers na scoutsjaar
-- display: table
-- size: half
-- @include facts-alle-jaren
-- Een scoutsjaar is de naam van de periode: elke eenheid houdt een eigen periode-rij voor hetzelfde
-- jaar, dus alleen de naam is over alle eenheden heen hetzelfde.
, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LEAD(name) OVER (ORDER BY MIN(startDate)) AS volgend
    FROM registration_periods
    GROUP BY name
)
SELECT
    j.name AS `Scoutsjaar`,
    COUNT(DISTINCT huidig.member_id) AS `Aantal leden`,
    COUNT(DISTINCT volgend.member_id) AS `Aantal blijvers`,
    COUNT(DISTINCT huidig.member_id) - COUNT(DISTINCT volgend.member_id) AS `Aantal vertrekkers`,
    ROUND(100 * COUNT(DISTINCT volgend.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren j
JOIN facts huidig ON huidig.`Scoutsjaar` = j.name
LEFT JOIN facts volgend
    ON volgend.`Scoutsjaar` = j.volgend
    AND volgend.member_id = huidig.member_id
    AND volgend.organization_id = huidig.organization_id
WHERE j.volgend IS NOT NULL
GROUP BY j.name, j.startDate
ORDER BY j.startDate

-- @card eenheid-ledenbehoud-per-tak
-- title: Ledenbehoud per tak: blijvers & vertrekkers na scoutsjaar
-- display: table
-- size: half
-- @include facts-alle-jaren
-- Een scoutsjaar is de naam van de periode: elke eenheid houdt een eigen periode-rij voor hetzelfde
-- jaar, dus alleen de naam is over alle eenheden heen hetzelfde.
, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LEAD(name) OVER (ORDER BY MIN(startDate)) AS volgend
    FROM registration_periods
    GROUP BY name
)
, gekozen AS (
    SELECT name, volgend FROM jaren
    WHERE 1 = 1 [[AND name = {{scoutsjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
SELECT
    huidig.`Tak`,
    COUNT(DISTINCT huidig.member_id) AS `Aantal leden`,
    COUNT(DISTINCT volgend.member_id) AS `Aantal blijvers`,
    COUNT(DISTINCT huidig.member_id) - COUNT(DISTINCT volgend.member_id) AS `Aantal vertrekkers`,
    ROUND(100 * COUNT(DISTINCT volgend.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM gekozen g
JOIN facts huidig ON huidig.`Scoutsjaar` = g.name
LEFT JOIN facts volgend
    ON volgend.`Scoutsjaar` = g.volgend
    AND volgend.member_id = huidig.member_id
    AND volgend.organization_id = huidig.organization_id
GROUP BY huidig.`Tak`
ORDER BY MIN(COALESCE(huidig.tak_min_age, 99)), huidig.`Tak`

-- @card eenheid-evolutie-ledenbehoud
-- title: Evolutie ledenbehoud op eenheidsniveau
-- display: line
-- size: half
-- dimensions: Scoutsjaar
-- metrics: Percentage blijvers
-- @include facts-alle-jaren
-- Een scoutsjaar is de naam van de periode: elke eenheid houdt een eigen periode-rij voor hetzelfde
-- jaar, dus alleen de naam is over alle eenheden heen hetzelfde.
, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LEAD(name) OVER (ORDER BY MIN(startDate)) AS volgend
    FROM registration_periods
    GROUP BY name
)
SELECT
    j.name AS `Scoutsjaar`,
    ROUND(100 * COUNT(DISTINCT volgend.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren j
JOIN facts huidig ON huidig.`Scoutsjaar` = j.name
LEFT JOIN facts volgend
    ON volgend.`Scoutsjaar` = j.volgend
    AND volgend.member_id = huidig.member_id
    AND volgend.organization_id = huidig.organization_id
WHERE j.volgend IS NOT NULL
GROUP BY j.name, j.startDate
ORDER BY j.startDate

-- @card eenheid-evolutie-blijvers-per-tak
-- title: Evolutie percentage blijvers per tak
-- display: line
-- size: half
-- dimensions: Scoutsjaar, Tak
-- metrics: Percentage blijvers
-- @include facts-alle-jaren
-- Een scoutsjaar is de naam van de periode: elke eenheid houdt een eigen periode-rij voor hetzelfde
-- jaar, dus alleen de naam is over alle eenheden heen hetzelfde.
, jaren AS (
    SELECT name, MIN(startDate) AS startDate, LEAD(name) OVER (ORDER BY MIN(startDate)) AS volgend
    FROM registration_periods
    GROUP BY name
)
SELECT
    j.name AS `Scoutsjaar`,
    huidig.`Tak`,
    ROUND(100 * COUNT(DISTINCT volgend.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren j
JOIN facts huidig ON huidig.`Scoutsjaar` = j.name
LEFT JOIN facts volgend
    ON volgend.`Scoutsjaar` = j.volgend
    AND volgend.member_id = huidig.member_id
    AND volgend.organization_id = huidig.organization_id
WHERE j.volgend IS NOT NULL
GROUP BY j.name, j.startDate, huidig.`Tak`
ORDER BY j.startDate, huidig.`Tak`
