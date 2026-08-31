-- @tab eenheden
-- title: Eenheden
-- description: Alles over een enkele eenheid. Kies een eenheid en een scoutsjaar bovenaan.
-- filters: scoutsjaar, eenheid, aansluiting, ingeschreven_voor

-- @card eenheid-totaal-leden
-- title: Totaal aantal leden
-- display: scalar
-- size: sixth
-- @include facts
-- @include leden
SELECT COUNT(DISTINCT member_id) AS `Totaal aantal leden` FROM leden

-- @card eenheid-aantal-kinderen
-- title: Aantal kinderen
-- display: scalar
-- size: sixth
-- @include facts
-- @include leden
SELECT COUNT(DISTINCT member_id) AS `Aantal kinderen` FROM leden WHERE effective_category = 'child'

-- @card eenheid-aantal-leiding
-- title: Aantal leiding
-- display: scalar
-- size: sixth
-- @include facts
-- @include leden
SELECT COUNT(DISTINCT member_id) AS `Aantal leiding` FROM leden WHERE effective_category = 'leader'

-- @card eenheid-aantal-volwassenen
-- title: Aantal volwassenen
-- display: scalar
-- size: sixth
-- @include facts
-- @include leden
SELECT COUNT(DISTINCT member_id) AS `Aantal volwassenen` FROM leden WHERE effective_category = 'adult'

-- @card eenheid-gtp
-- title: GTP Index
-- display: scalar
-- size: sixth
-- segments: 0, 35, 55, 75, 95, 115, 135
-- description: GTP staat voor Gezond Toekomst Perspectief. Idealiter scoort een eenheid 100 of meer.
-- @include facts
-- @include leden
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
-- @include facts
-- @include leden
SELECT
    -- @include omkaderingscijfer
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
-- @include facts
-- @include leden
-- @include postcode-coordinaten
SELECT
    f.postcode AS `Postcode`,
    c.latitude AS `Breedtegraad`,
    c.longitude AS `Lengtegraad`,
    COUNT(DISTINCT f.member_id) AS `Aantal leden`
FROM leden f
LEFT JOIN postcode_coordinaten c ON c.postalCode = f.postcode
GROUP BY f.postcode, c.latitude, c.longitude
ORDER BY `Aantal leden` DESC

-- @card eenheid-leden-per-scoutsjaar
-- title: Aantal leden per scoutsjaar
-- display: line
-- size: full
-- dimensions: Scoutsjaar
-- metrics: Totaal leden, Aantal kinderen, Aantal leiding, Aantal volwassenen
-- @include facts-alle-jaren
-- @include leden
SELECT
    `Scoutsjaar`,
    COUNT(DISTINCT member_id) AS `Totaal leden`,
    COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END) AS `Aantal kinderen`,
    COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END) AS `Aantal leiding`,
    COUNT(DISTINCT CASE WHEN effective_category = 'adult' THEN member_id END) AS `Aantal volwassenen`
FROM leden
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-gtp-meter
-- title: GTP Index (meter)
-- display: gauge
-- size: third
-- segments: 0, 35, 55, 75, 95, 115, 135
-- description: GTP staat voor Gezond Toekomst Perspectief. De berekening schenkt veel waarde aan potentieel toekomstige leiding (VG's & Seniors) op korte termijn. Idealiter scoort een eenheid 100 of meer op deze index. Dit geeft enkel een indicatie voor eenheden tot ongeveer 150 leden, daarna worden ze sowieso gezond geacht.
-- description@ravot: GTP staat voor Gezond Toekomst Perspectief. De berekening schenkt veel waarde aan potentieel toekomstige leiding (14- tot 16-jarigen) op korte termijn. Idealiter scoort een eenheid 100 of meer op deze index. Dit geeft enkel een indicatie voor eenheden tot ongeveer 150 leden, daarna worden ze sowieso gezond geacht.
-- @include facts
-- @include leden
SELECT
    -- @include gtp
        AS `GTP Index`
FROM leden

-- @card eenheid-gtp-per-scoutsjaar
-- title: GTP index per Scoutsjaar
-- display: line
-- size: two-thirds
-- dimensions: Scoutsjaar
-- metrics: GTP index
-- @include facts-alle-jaren
-- @include leden
SELECT
    `Scoutsjaar`,
    -- @include gtp
        AS `GTP index`
FROM leden
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-omkaderingscijfer-meter
-- title: Omkaderingscijfer (meter)
-- display: gauge
-- size: third
-- segments: 0, 4, 6, 8, 10, 12
-- best: low
-- description: Het omkaderingscijfer geeft weer voor hoeveel leden een leider gemiddeld dient te zorgen. Idealiter scoort een eenheid hier laag op. Bij een cijfer van 10 of meer wordt toezicht houden op de leden moeilijker.
-- description@ravot: Het omkaderingscijfer geeft weer voor hoeveel leden jonger dan 17 jaar een leider gemiddeld dient te zorgen. Idealiter scoort een eenheid hier laag op. Bij een cijfer van 10 of meer wordt toezicht houden op de leden moeilijker.
-- @include facts
-- @include leden
SELECT
    -- @include omkaderingscijfer
        AS `Omkaderingscijfer`
FROM leden

-- @card eenheid-omkaderingscijfer-per-scoutsjaar
-- title: Omkaderingscijfer per Scoutsjaar
-- display: line
-- size: two-thirds
-- dimensions: Scoutsjaar
-- metrics: Omkaderingscijfer
-- @include facts-alle-jaren
-- @include leden
SELECT
    `Scoutsjaar`,
    -- @include omkaderingscijfer
        AS `Omkaderingscijfer`
FROM leden
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-leden-per-geslacht
-- title: Aantal leden per geslacht
-- display: pie
-- size: half
-- dimensions: Geslacht
-- metrics: Aantal leden
-- @include facts
-- @include leden
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
-- @include facts
-- @include leden
SELECT
    -- @include tarief
        AS `Type lidgeld`,
    COUNT(DISTINCT mpm.memberId) AS `Aantal leden`
FROM member_platform_memberships mpm
-- Het lidgeld van een lid in het jaar waarin het lid was, als één join op het paar. Niet als een
-- IN-subquery per kolom: `leden` wordt dan per subquery opnieuw opgebouwd en MySQL hasht die twee
-- resultaten tegen elkaar, waarmee de kaart niet meer laadt. Het paar is meteen ook wat de kaart
-- telt -- een lidgeld uit een jaar waarin dat lid geen lid was, hoort er niet bij.
JOIN (SELECT DISTINCT member_id, period_id FROM leden) l
    ON l.member_id = mpm.memberId AND l.period_id = mpm.periodId
-- Enkel nog om op de aansluiting te kunnen filteren: waar de taart op splitst is het tarief, en dat
-- staat op het lidgeld zelf.
JOIN platform_membership_types mt ON mt.id = mpm.membershipTypeId AND mt.periodId = mpm.periodId
WHERE mpm.deletedAt IS NULL
  -- Geen lidmaatschap bij de koepel zelf: `facts` laat die organisatie weg, en wie naast een eenheid
  -- ook in een nationale ploeg zit zou het tarief daarvan anders in deze grafiek zetten.
  AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = mpm.organizationId)
  -- Alleen de gekozen aansluitingen: `facts` houdt de leden over die er een van hebben, en zonder
  -- dit zou de taart daarnaast ook de andere aansluitingen van net die leden tonen.
  [[AND mt.name IN ({{aansluiting}})]]
GROUP BY mpm.reducedPrice
ORDER BY `Aantal leden` DESC

-- @card eenheid-evolutie-per-tak
-- title: Evolutie ledenaantallen per tak
-- display: line
-- size: full
-- dimensions: Scoutsjaar, Tak
-- metrics: Aantal kinderen
-- @include facts-alle-jaren
-- @include leden
SELECT
    `Scoutsjaar`,
    `Tak`,
    COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Scoutsjaar`, `Tak`
ORDER BY MIN(period_start), `Tak`

-- @card eenheid-jong-versus-oud
-- title: Verhouding jongste versus oudste leden
-- display: row
-- size: full
-- dimensions: Scoutsjaar
-- metrics: Jong, Oud
-- stacked: normalized
-- description: Jong zijn de takken tot en met 10 jaar, oud de takken vanaf 11 jaar. Het originele rapport benoemt de grens niet.
-- @include facts-alle-jaren
-- @include leden
SELECT
    `Scoutsjaar`,
    COUNT(DISTINCT CASE WHEN tak_max_age <= 10 THEN member_id END) AS `Jong`,
    COUNT(DISTINCT CASE WHEN tak_min_age >= 11 THEN member_id END) AS `Oud`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Scoutsjaar`
-- A row chart draws its first row at the top, so the most recent scoutsjaar comes back first.
ORDER BY MIN(period_start) DESC

-- @card eenheid-geslacht-kinderen-per-jaar
-- title: Verhouding tussen de geslachten: kinderen
-- display: row
-- size: two-thirds
-- dimensions: Scoutsjaar, Geslacht
-- metrics: Aantal kinderen
-- stacked: normalized
-- @include facts-alle-jaren
-- @include leden
SELECT
    `Scoutsjaar`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Scoutsjaar`, `Geslacht`
-- A row chart draws its first row at the top, so the most recent scoutsjaar comes back first.
ORDER BY MIN(period_start) DESC

-- @card eenheid-kinderen-per-geslacht
-- title: Aantal kinderen per geslacht
-- display: pie
-- size: third
-- dimensions: Geslacht
-- metrics: Aantal kinderen
-- @include facts
-- @include leden
SELECT `Geslacht`, COUNT(DISTINCT member_id) AS `Aantal kinderen`
FROM leden
WHERE effective_category = 'child'
GROUP BY `Geslacht`
ORDER BY `Aantal kinderen` DESC

-- @card eenheid-geslacht-leiding-per-jaar
-- title: Verhouding tussen de geslachten: leiding
-- display: row
-- size: two-thirds
-- dimensions: Scoutsjaar, Geslacht
-- metrics: Aantal leiding
-- stacked: normalized
-- @include facts-alle-jaren
-- @include leden
SELECT
    `Scoutsjaar`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal leiding`
FROM leden
WHERE effective_category = 'leader'
GROUP BY `Scoutsjaar`, `Geslacht`
-- A row chart draws its first row at the top, so the most recent scoutsjaar comes back first.
ORDER BY MIN(period_start) DESC

-- @card eenheid-leiding-per-geslacht
-- title: Aantal leiding per geslacht
-- display: pie
-- size: third
-- dimensions: Geslacht
-- metrics: Aantal leiding
-- @include facts
-- @include leden
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
-- @include facts
-- @include leden
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
-- @include facts
-- @include leden
SELECT
    leeftijd AS `Leeftijd`,
    `Geslacht`,
    COUNT(DISTINCT member_id) AS `Aantal leden`
FROM leden
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
-- @include leden
SELECT
    `Scoutsjaar`,
    ROUND(AVG(leeftijd), 1) AS `Gemiddelde leeftijd leiding`
FROM leden
WHERE effective_category = 'leader' AND birth_date IS NOT NULL
GROUP BY `Scoutsjaar`
ORDER BY MIN(period_start)

-- @card eenheid-ledenbehoud
-- title: Ledenbehoud: blijvers & vertrekkers per scoutsjaar
-- display: table
-- size: half
-- description: Per scoutsjaar: hoeveel leden de eenheid dat jaar had, en hoeveel daarvan het jaar erna nog lid waren. Het laatste scoutsjaar staat er niet bij: het jaar erna moet eerst bestaan.
-- @include facts-alle-jaren
-- @include leden
-- @include leden-per-jaar
-- @include jaren
SELECT
    j.name AS `Scoutsjaar`,
    COUNT(DISTINCT huidig.member_id) AS `Aantal leden`,
    COUNT(DISTINCT gebleven.member_id) AS `Aantal blijvers`,
    COUNT(DISTINCT huidig.member_id) - COUNT(DISTINCT gebleven.member_id) AS `Aantal vertrekkers`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren j
JOIN leden huidig ON huidig.`Scoutsjaar` = j.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Scoutsjaar` = j.volgend
    AND gebleven.member_id = huidig.member_id
WHERE j.volgend IS NOT NULL
GROUP BY j.name, j.startDate
ORDER BY j.startDate

-- @card eenheid-ledenbehoud-per-tak
-- title: Ledenbehoud per tak: blijvers & vertrekkers per scoutsjaar
-- display: table
-- size: half
-- description: De leden van het gekozen scoutsjaar, per tak waar ze toen zaten, en hoeveel daarvan het jaar erna nog lid waren. Het laatste scoutsjaar staat er niet bij: het jaar erna moet eerst bestaan.
-- @include facts-alle-jaren
-- @include leden
-- @include leden-per-jaar
-- @include jaren
, gekozen AS (
    SELECT name, volgend FROM jaren
    WHERE volgend IS NOT NULL [[AND name = {{scoutsjaar}}]]
    ORDER BY startDate DESC
    LIMIT 1
)
SELECT
    huidig.`Tak`,
    COUNT(DISTINCT huidig.member_id) AS `Aantal leden`,
    COUNT(DISTINCT gebleven.member_id) AS `Aantal blijvers`,
    COUNT(DISTINCT huidig.member_id) - COUNT(DISTINCT gebleven.member_id) AS `Aantal vertrekkers`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM gekozen g
JOIN leden huidig ON huidig.`Scoutsjaar` = g.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Scoutsjaar` = g.volgend
    AND gebleven.member_id = huidig.member_id
GROUP BY huidig.`Tak`
ORDER BY MIN(COALESCE(huidig.tak_min_age, 99)), huidig.`Tak`

-- @card eenheid-evolutie-ledenbehoud
-- title: Evolutie ledenbehoud op eenheidsniveau
-- display: line
-- size: full
-- dimensions: Scoutsjaar
-- metrics: Percentage blijvers
-- description: Per scoutsjaar het percentage van de leden van dat jaar dat het jaar erna nog lid was. Het laatste scoutsjaar staat er niet bij: het jaar erna moet eerst bestaan.
-- @include facts-alle-jaren
-- @include leden
-- @include leden-per-jaar
-- @include jaren
SELECT
    j.name AS `Scoutsjaar`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren j
JOIN leden huidig ON huidig.`Scoutsjaar` = j.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Scoutsjaar` = j.volgend
    AND gebleven.member_id = huidig.member_id
WHERE j.volgend IS NOT NULL
GROUP BY j.name, j.startDate
ORDER BY j.startDate

-- @card eenheid-evolutie-blijvers-per-tak
-- title: Evolutie percentage blijvers per tak
-- display: line
-- size: full
-- dimensions: Scoutsjaar, Tak
-- metrics: Percentage blijvers
-- description: Per scoutsjaar het percentage van de leden van dat jaar dat het jaar erna nog lid was, per tak waar ze dat jaar zaten. Het laatste scoutsjaar staat er niet bij: het jaar erna moet eerst bestaan.
-- @include facts-alle-jaren
-- @include leden
-- @include leden-per-jaar
-- @include jaren
SELECT
    j.name AS `Scoutsjaar`,
    huidig.`Tak`,
    ROUND(100 * COUNT(DISTINCT gebleven.member_id) / COUNT(DISTINCT huidig.member_id), 1) AS `Percentage blijvers`
FROM jaren j
JOIN leden huidig ON huidig.`Scoutsjaar` = j.name
LEFT JOIN leden_per_jaar gebleven
    ON gebleven.`Scoutsjaar` = j.volgend
    AND gebleven.member_id = huidig.member_id
WHERE j.volgend IS NOT NULL
GROUP BY j.name, j.startDate, huidig.`Tak`
ORDER BY j.startDate, huidig.`Tak`
