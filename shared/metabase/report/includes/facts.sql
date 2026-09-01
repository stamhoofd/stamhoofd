WITH
-- @include takken
all_registrations AS (
    SELECT
        r.memberId AS member_id,
        r.organizationId AS organization_id,
        o.uri AS organization_uri,
        o.name AS `Eenheid`,
        o.postalCode AS eenheid_postcode,
        o.city AS eenheid_gemeente,
        p.id AS period_id,
        p.name AS `Scoutsjaar`,
        p.startDate AS period_start,
        g.type AS group_type,
        COALESCE(dag.name, g.name) AS `Tak`,
        dag.id AS tak_id,
        dag.category AS tak_category,
        dag.minAge AS tak_min_age,
        dag.maxAge AS tak_max_age,
        COALESCE(
            dag.category,
            CASE WHEN dag.maxAge < 18 THEN 'child' END,
            CASE WHEN TIMESTAMPDIFF(YEAR, m.birthDate, p.startDate) < 18 THEN 'child' END
        ) AS effective_category,
        CASE m.gender
            WHEN 'Male' THEN 'Man'
            WHEN 'Female' THEN 'Vrouw'
            WHEN 'Other' THEN 'Andere'
            ELSE 'Onbekend'
        END AS `Geslacht`,
        m.birthDate AS birth_date,
        TIMESTAMPDIFF(YEAR, m.birthDate, p.startDate) AS leeftijd,
        m.postalCode AS postcode,
        r.deactivatedAt AS deactivated_at
    FROM registrations r
    JOIN registration_periods p ON p.id = r.periodId
    JOIN `groups` g ON g.id = r.groupId AND g.deletedAt IS NULL
    -- The tak, the member and the eenheid are each recorded per year, so the period is part of what
    -- identifies the row to join to: a tak that is renamed or a member who moves changes the year it
    -- happened in, not every year they were ever counted in.
    LEFT JOIN takken dag ON dag.id = g.defaultAgeGroupId AND dag.periodId = r.periodId
    JOIN members m ON m.id = r.memberId AND m.periodId = r.periodId
    JOIN organizations o ON o.id = r.organizationId AND o.periodId = r.periodId
        AND o.active = 1
    WHERE r.registeredAt IS NOT NULL
      [[AND p.name = {{scoutsjaar}}]]
      [[AND o.name = {{eenheid}}]]
      -- @include inschrijvingen
),
-- The koepel's own organization is not an eenheid: it is the national body, and the client's report
-- counts the structuurvrijwilligers of its ploegen as nobody's leden and nobody's leiding. Which
-- organization it is comes from `platform.membershipOrganizationId`, the only thing that says so --
-- the import writes the koepel under that same id, so the years it owns drop out here exactly as the
-- synced ones do.
facts AS (
    SELECT f.* FROM all_registrations f
    WHERE NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = f.organization_id)
)
