-- The same grain as `facts`, but never filtered by scoutsjaar: the cards that draw a line across the
-- years need every year regardless of which one the dashboard filter has selected. Keep the two in
-- step when changing what counts as an active registration.
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
    -- The tak, the member and the eenheid are each recorded per year, so the period is part of what
    -- identifies the row to join to: a tak that is renamed or a member who moves changes the year it
    -- happened in, not every year they were ever counted in.
    LEFT JOIN default_age_groups dag ON dag.id = g.defaultAgeGroupId AND dag.periodId = r.periodId
    JOIN members m ON m.id = r.memberId AND m.periodId = r.periodId
    JOIN organizations o ON o.id = r.organizationId AND o.periodId = r.periodId
    WHERE r.deactivatedAt IS NULL
      AND r.registeredAt IS NOT NULL
      -- Not the koepel's own organization: it is the national body rather than an eenheid, and the
      -- ledenstatistieken count none of its structuurvrijwilligers. See `facts.sql`.
      AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = r.organizationId)
      [[AND o.name = {{eenheid}}]]
)
