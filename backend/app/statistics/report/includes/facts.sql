-- One row per member per group per scoutsjaar: the grain every figure in the report is counted from.
--
-- The scoutsjaar is the period's name, not its id. A registration points at the period of its own
-- organization, and every organization holds its own row for the same year, so the id identifies a
-- unit's year rather than the year itself. The name is what those rows share, which makes it the
-- only thing a national figure can group on. Imported years are single platform-wide rows and fall
-- out of the same rule.
--
-- A registration counts when it is active: not cancelled, not on a waiting list, and actually
-- registered. A member in two groups appears twice here, so member counts are always COUNT(DISTINCT).
--
-- `Categorie` is what splits the report into kinderen, leiding and volwassenen. It comes from the tak,
-- falling back to the tak's age range, and then to the member's own age at the start of the year.
--
-- That last fallback carries the imported years. The import recorded a tak only for leiding and
-- volwassenen and put every child in a nameless tak with no age range at all, so without it every
-- one of those members counts towards the total while showing up in none of the three categories --
-- "aantal kinderen" was zero until 2019-2020. Age settles it: every registration in that nameless
-- tak is a member under 18, bar 48 in 2019-2020. Those 48 stay null, because nothing here tells
-- leiding from volwassenen.
WITH facts AS (
    SELECT
        r.memberId AS member_id,
        r.organizationId AS organization_id,
        o.name AS `Eenheid`,
        o.postalCode AS eenheid_postcode,
        o.city AS eenheid_gemeente,
        p.id AS period_id,
        p.name AS `Scoutsjaar`,
        p.startDate AS period_start,
        COALESCE(dag.name, g.name) AS `Tak`,
        COALESCE(
            dag.category,
            CASE WHEN dag.maxAge < 18 THEN 'child' END,
            CASE WHEN TIMESTAMPDIFF(YEAR, m.birthDate, p.startDate) < 18 THEN 'child' END
        ) AS categorie,
        dag.minAge AS tak_min_age,
        dag.maxAge AS tak_max_age,
        CASE m.gender
            WHEN 'Male' THEN 'Man'
            WHEN 'Female' THEN 'Vrouw'
            WHEN 'Other' THEN 'Andere'
            ELSE 'Onbekend'
        END AS `Geslacht`,
        m.birthDate AS birth_date,
        TIMESTAMPDIFF(YEAR, m.birthDate, p.startDate) AS leeftijd,
        m.postalCode AS postcode
    FROM registrations r
    JOIN registration_periods p ON p.id = r.periodId
    JOIN `groups` g ON g.id = r.groupId AND g.deletedAt IS NULL
    LEFT JOIN default_age_groups dag ON dag.id = g.defaultAgeGroupId
    JOIN members m ON m.id = r.memberId
    JOIN organizations o ON o.id = r.organizationId
    WHERE r.deactivatedAt IS NULL
      AND r.waitingList = 0
      AND r.registeredAt IS NOT NULL
      [[AND p.name = {{scoutsjaar}}]]
      [[AND o.name = {{eenheid}}]]
)
