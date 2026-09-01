-- @tab eenheden
-- title: Eenheden
-- description: Alles over een enkele eenheid. Kies een eenheid en een werkjaar bovenaan.
-- filters: werkjaar, eenheid, platformleden_opnemen
-- required: werkjaar

-- @card eenheid-totaal-leden
-- title: Totaal aantal leden
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Totaal aantal leden` FROM leden

-- @card eenheid-aantal-kinderen
-- title: Aantal kinderen
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Aantal kinderen` FROM leden WHERE effective_category = 'child'

-- @card eenheid-aantal-leiding
-- title: Aantal leiding
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Aantal leiding` FROM leden WHERE effective_category = 'leader'

-- @card eenheid-aantal-volwassenen
-- title: Aantal volwassenen
-- display: scalar
-- size: sixth
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT COUNT(DISTINCT member_id) AS `Aantal volwassenen` FROM leden WHERE effective_category = 'adult'

-- @card eenheid-gtp
-- title: GTP Index
-- display: scalar
-- size: sixth
-- segments: 0, 35, 55, 75, 95, 115, 135
-- description: GTP staat voor Gezond Toekomst Perspectief. Idealiter scoort een eenheid 100 of meer.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    -- @include gtp
        AS `GTP Index`
FROM leden

-- @card eenheid-omkaderingscijfer
-- title: Omkaderingscijfer
-- display: scalar
-- size: sixth
-- segments: 0, 4, 6, 8, 10, 12
-- best: low
-- description: Het omkaderingscijfer geeft weer voor hoeveel leden een leider gemiddeld dient te zorgen. Idealiter scoort een eenheid hier laag op.
-- description@ravot: Het omkaderingscijfer geeft weer voor hoeveel leden jonger dan 17 jaar een leider gemiddeld dient te zorgen. Idealiter scoort een eenheid hier laag op.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    -- @include child-leader-ratio
        AS `Omkaderingscijfer`
FROM leden

-- @card eenheid-leden-per-postcode
-- title: Aantal leden per postcode
-- display: map
-- latitude: Breedtegraad
-- longitude: Lengtegraad
-- size: full
-- dimensions: Postcode
-- metrics: Aantal leden
-- description: Een punt per postcode. Een postcode zonder coordinaat in `postal_codes` telt wel mee, maar staat niet op de kaart.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
),
postcode_coordinaten AS (
    -- @include postal-code-coordinates
)
SELECT
    leden.postcode AS `Postcode`,
    postcode_coordinaten.latitude AS `Breedtegraad`,
    postcode_coordinaten.longitude AS `Lengtegraad`,
    COUNT(DISTINCT leden.member_id) AS `Aantal leden`
FROM leden
LEFT JOIN postcode_coordinaten ON postcode_coordinaten.postalCode = leden.postcode
GROUP BY leden.postcode, postcode_coordinaten.latitude, postcode_coordinaten.longitude
ORDER BY `Aantal leden` DESC

-- @card eenheid-leden-per-werkjaar
-- title: Aantal leden per werkjaar
-- display: line
-- size: full
-- dimensions: Werkjaar
-- metrics: Totaal leden, Aantal kinderen, Aantal leiding, Aantal volwassenen
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    COUNT(DISTINCT member_id) AS `Totaal leden`,
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN effective_category = 'adult' THEN member_id END) AS `Aantal volwassenen`
FROM leden
GROUP BY `Werkjaar`
ORDER BY MIN(period_start)

-- @card eenheid-gtp-meter
-- title: GTP Index (meter)
-- display: gauge
-- size: third
-- segments: 0, 35, 55, 75, 95, 115, 135
-- description: GTP staat voor Gezond Toekomst Perspectief. De berekening schenkt veel waarde aan potentieel toekomstige leiding (VG's & Seniors) op korte termijn. Idealiter scoort een eenheid 100 of meer op deze index. Dit geeft enkel een indicatie voor eenheden tot ongeveer 150 leden, daarna worden ze sowieso gezond geacht.
-- description@ravot: GTP staat voor Gezond Toekomst Perspectief. De berekening schenkt veel waarde aan potentieel toekomstige leiding (14- tot 16-jarigen) op korte termijn. Idealiter scoort een eenheid 100 of meer op deze index. Dit geeft enkel een indicatie voor eenheden tot ongeveer 150 leden, daarna worden ze sowieso gezond geacht.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    -- @include gtp
        AS `GTP Index`
FROM leden

-- @card eenheid-gtp-per-werkjaar
-- title: GTP index per Werkjaar
-- display: line
-- size: two-thirds
-- dimensions: Werkjaar
-- metrics: GTP index
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    -- @include gtp
        AS `GTP index`
FROM leden
GROUP BY `Werkjaar`
ORDER BY MIN(period_start)

-- @card eenheid-omkaderingscijfer-meter
-- title: Omkaderingscijfer (meter)
-- display: gauge
-- size: third
-- segments: 0, 4, 6, 8, 10, 12
-- best: low
-- description: Het omkaderingscijfer geeft weer voor hoeveel leden een leider gemiddeld dient te zorgen. Idealiter scoort een eenheid hier laag op. Bij een cijfer van 10 of meer wordt toezicht houden op de leden moeilijker.
-- description@ravot: Het omkaderingscijfer geeft weer voor hoeveel leden jonger dan 17 jaar een leider gemiddeld dient te zorgen. Idealiter scoort een eenheid hier laag op. Bij een cijfer van 10 of meer wordt toezicht houden op de leden moeilijker.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    -- @include child-leader-ratio
        AS `Omkaderingscijfer`
FROM leden

-- @card eenheid-omkaderingscijfer-per-werkjaar
-- title: Omkaderingscijfer per Werkjaar
-- display: line
-- size: two-thirds
-- dimensions: Werkjaar
-- metrics: Omkaderingscijfer
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    -- @include child-leader-ratio
        AS `Omkaderingscijfer`
FROM leden
GROUP BY `Werkjaar`
ORDER BY MIN(period_start)

-- @card eenheid-leden-per-geslacht
-- title: Aantal leden per geslacht
-- display: pie
-- size: half
-- dimensions: Geslacht
-- metrics: Aantal leden
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal leden`
FROM leden
GROUP BY `Geslacht`
ORDER BY `Aantal leden` DESC

-- @card eenheid-leden-per-type-lidgeld
-- title: Aantal leden per type lidgeld
-- display: pie
-- size: half
-- dimensions: Type lidgeld
-- metrics: Aantal leden
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    -- @include membership-fee-type
        AS `Type lidgeld`,
    COUNT(DISTINCT member_platform_memberships.memberId) AS `Aantal leden`
FROM member_platform_memberships
JOIN (SELECT DISTINCT member_id, period_id FROM leden) leden_periodes
    ON leden_periodes.member_id = member_platform_memberships.memberId
    AND leden_periodes.period_id = member_platform_memberships.periodId
WHERE member_platform_memberships.deletedAt IS NULL
  AND (
      {{platformleden_opnemen}}
      OR NOT EXISTS (SELECT 1 FROM platform WHERE platform.membershipOrganizationId = member_platform_memberships.organizationId)
  )
  AND (
      -- @include filter-statistics-memberships
  )
GROUP BY member_platform_memberships.reducedPrice
ORDER BY `Aantal leden` DESC

-- @card eenheid-evolutie-per-leeftijdsgroep
-- title: Evolutie ledenaantallen per leeftijdsgroep
-- display: line
-- size: full
-- dimensions: Werkjaar, Leeftijdsgroep
-- metrics: Aantal kinderen
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    `Leeftijdsgroep`,
    COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Werkjaar`, `Leeftijdsgroep`
ORDER BY MIN(period_start), `Leeftijdsgroep`

-- @card eenheid-jong-versus-oud
-- title: Verhouding jongste versus oudste leden
-- display: row
-- size: full
-- dimensions: Werkjaar
-- metrics: Jong, Oud
-- stacked: normalized
-- description: Jong zijn de leeftijdsgroepen tot en met 10 jaar, oud de leeftijdsgroepen vanaf 11 jaar. Het originele rapport benoemt de grens niet.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    COUNT(DISTINCT CASE WHEN age_group_max_age <= 10 THEN member_id END) AS `Jong`,
    COUNT(DISTINCT CASE WHEN age_group_min_age >= 11 THEN member_id END) AS `Oud`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Werkjaar`
-- A row chart draws its first row at the top, so the most recent werkjaar comes back first.
ORDER BY MIN(period_start) DESC

-- @card eenheid-geslacht-kinderen-per-jaar
-- title: Verhouding tussen de geslachten: kinderen
-- display: row
-- size: two-thirds
-- dimensions: Werkjaar, Geslacht
-- metrics: Aantal kinderen
-- stacked: normalized
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Werkjaar`, `Geslacht`
-- A row chart draws its first row at the top, so the most recent werkjaar comes back first.
ORDER BY MIN(period_start) DESC

-- @card eenheid-kinderen-per-geslacht
-- title: Aantal kinderen per geslacht
-- display: pie
-- size: third
-- dimensions: Geslacht
-- metrics: Aantal kinderen
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Geslacht`
ORDER BY `Aantal kinderen` DESC

-- @card eenheid-geslacht-leiding-per-jaar
-- title: Verhouding tussen de geslachten: leiding
-- display: row
-- size: two-thirds
-- dimensions: Werkjaar, Geslacht
-- metrics: Aantal leiding
-- stacked: normalized
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal leiding`
FROM leden
WHERE effective_category = 'leader'
GROUP BY `Werkjaar`, `Geslacht`
-- A row chart draws its first row at the top, so the most recent werkjaar comes back first.
ORDER BY MIN(period_start) DESC

-- @card eenheid-leiding-per-geslacht
-- title: Aantal leiding per geslacht
-- display: pie
-- size: third
-- dimensions: Geslacht
-- metrics: Aantal leiding
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal leiding`
FROM leden
WHERE effective_category = 'leader'
GROUP BY `Geslacht`
ORDER BY `Aantal leiding` DESC

-- @card eenheid-leden-per-geboortejaar
-- title: Aantal leden en leiding per geboortejaar
-- display: bar
-- size: full
-- dimensions: Geboortejaar
-- metrics: Aantal kinderen, Aantal leiding
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    YEAR(birth_date) AS `Geboortejaar`,
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`
FROM leden
WHERE birth_date IS NOT NULL
GROUP BY YEAR(birth_date)
ORDER BY `Geboortejaar`

-- @card eenheid-leeftijd-en-geslacht
-- title: Aantal leden per Leeftijd en Geslacht
-- display: bar
-- size: full
-- dimensions: Leeftijd, Geslacht
-- metrics: Aantal leden
WITH leden AS (
    -- @include deduplicated-non-platform-registrations
)
SELECT
    leeftijd AS `Leeftijd`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal leden`
FROM leden
WHERE birth_date IS NOT NULL
GROUP BY leeftijd, `Geslacht`
ORDER BY leeftijd

-- @card eenheid-gemiddelde-leeftijd-leiding
-- title: Gemiddelde leeftijd leiding per Werkjaar
-- display: line
-- size: full
-- dimensions: Werkjaar
-- metrics: Gemiddelde leeftijd leiding
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
)
SELECT
    `Werkjaar`,
    ROUND(AVG(leeftijd), 1) AS `Gemiddelde leeftijd leiding`
FROM leden
WHERE effective_category = 'leader' AND birth_date IS NOT NULL
GROUP BY `Werkjaar`
ORDER BY MIN(period_start)

-- @card eenheid-ledenbehoud
-- title: Ledenbehoud: blijvers & vertrekkers per werkjaar
-- display: table
-- size: half
-- description: Per werkjaar: hoeveel leden de eenheid dat jaar had, en hoeveel daarvan het jaar erna nog lid waren. Het laatste werkjaar staat er niet bij: het jaar erna moet eerst bestaan.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
),
leden_per_jaar AS (
    -- @include members-per-year
),
jaren AS (
    -- @include years-with-members
)
SELECT
    jaren.name AS `Werkjaar`,
    COUNT(DISTINCT huidig.member_id) AS `Aantal leden`,
    COUNT(DISTINCT gebleven.member_id) AS `Aantal blijvers`,
    COUNT(DISTINCT huidig.member_id) - COUNT(DISTINCT gebleven.member_id) AS `Aantal vertrekkers`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren
JOIN leden huidig ON huidig.`Werkjaar` = jaren.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Werkjaar` = jaren.volgend
    AND gebleven.member_id = huidig.member_id
WHERE jaren.volgend IS NOT NULL
GROUP BY jaren.name, jaren.startDate
ORDER BY jaren.startDate

-- @card eenheid-ledenbehoud-per-leeftijdsgroep
-- title: Ledenbehoud per leeftijdsgroep: blijvers & vertrekkers per werkjaar
-- display: table
-- size: half
-- description: De leden van het gekozen werkjaar, per leeftijdsgroep waar ze toen zaten, en hoeveel daarvan het jaar erna nog lid waren. Het laatste werkjaar staat er niet bij: het jaar erna moet eerst bestaan.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
),
leden_per_jaar AS (
    -- @include members-per-year
),
jaren AS (
    -- @include years-with-members
),
gekozen AS (
    SELECT name, volgend FROM jaren
    WHERE volgend IS NOT NULL [[AND name = {{werkjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
SELECT
    huidig.`Leeftijdsgroep`,
    COUNT(DISTINCT huidig.member_id) AS `Aantal leden`,
    COUNT(DISTINCT gebleven.member_id) AS `Aantal blijvers`,
    COUNT(DISTINCT huidig.member_id) - COUNT(DISTINCT gebleven.member_id) AS `Aantal vertrekkers`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM gekozen
JOIN leden huidig ON huidig.`Werkjaar` = gekozen.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Werkjaar` = gekozen.volgend
    AND gebleven.member_id = huidig.member_id
GROUP BY huidig.`Leeftijdsgroep`
ORDER BY MIN(COALESCE(huidig.age_group_min_age, 99)), huidig.`Leeftijdsgroep`

-- @card eenheid-evolutie-ledenbehoud
-- title: Evolutie ledenbehoud op eenheidsniveau
-- display: line
-- size: full
-- dimensions: Werkjaar
-- metrics: Percentage blijvers
-- description: Per werkjaar het percentage van de leden van dat jaar dat het jaar erna nog lid was. Het laatste werkjaar staat er niet bij: het jaar erna moet eerst bestaan.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
),
leden_per_jaar AS (
    -- @include members-per-year
),
jaren AS (
    -- @include years-with-members
)
SELECT
    jaren.name AS `Werkjaar`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren
JOIN leden huidig ON huidig.`Werkjaar` = jaren.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Werkjaar` = jaren.volgend
    AND gebleven.member_id = huidig.member_id
WHERE jaren.volgend IS NOT NULL
GROUP BY jaren.name, jaren.startDate
ORDER BY jaren.startDate

-- @card eenheid-evolutie-blijvers-per-leeftijdsgroep
-- title: Evolutie percentage blijvers per leeftijdsgroep
-- display: line
-- size: full
-- dimensions: Werkjaar, Leeftijdsgroep
-- metrics: Percentage blijvers
-- description: Per werkjaar het percentage van de leden van dat jaar dat het jaar erna nog lid was, per leeftijdsgroep waar ze dat jaar zaten. Het laatste werkjaar staat er niet bij: het jaar erna moet eerst bestaan.
WITH leden AS (
    -- @include deduplicated-non-platform-registrations-all-years
),
leden_per_jaar AS (
    -- @include members-per-year
),
jaren AS (
    -- @include years-with-members
)
SELECT
    jaren.name AS `Werkjaar`,
    huidig.`Leeftijdsgroep`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren
JOIN leden huidig ON huidig.`Werkjaar` = jaren.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Werkjaar` = jaren.volgend
    AND gebleven.member_id = huidig.member_id
WHERE jaren.volgend IS NOT NULL
GROUP BY jaren.name, jaren.startDate, huidig.`Leeftijdsgroep`
ORDER BY jaren.startDate, huidig.`Leeftijdsgroep`
