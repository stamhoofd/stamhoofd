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
-- falling back to the age range when the tak has no category set — that recognises children, but
-- never tells leiding from volwassenen, so both stay null until the takken are categorised.
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
        COALESCE(dag.category, CASE WHEN dag.maxAge < 18 THEN 'child' END) AS categorie,
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
