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
-- That last fallback catches what the import could not name. The client's export leaves the tak empty
-- on the children of the years before 2020-2021; the import reads those from the member's age, except
-- where a date of birth puts them outside every tak. Without the fallback each of those few counts
-- towards the total while showing up in none of the three categories. The handful of adults among
-- them stay null, because nothing here tells leiding from volwassenen.
--
-- Two names for the same rows. `facts` is what every figure of the ledenstatistieken is counted from;
-- `all_facts` is the same set with the koepel's own organization still in it, for the aanlevering,
-- which is the one thing here that is about that organization.
WITH all_facts AS (
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
      [[AND p.name = {{scoutsjaar}}]]
      [[AND o.name = {{eenheid}}]]
),
-- The koepel's own organization is not an eenheid: it is the national body, and the client's report
-- counts the structuurvrijwilligers of its ploegen as nobody's leden and nobody's leiding. Which
-- organization it is comes from `platform.membershipOrganizationId`, the only thing that says so --
-- the import writes the koepel under that same id, so the years it owns drop out here exactly as the
-- synced ones do.
facts AS (
    SELECT f.* FROM all_facts f
    WHERE NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = f.organization_id)
)
