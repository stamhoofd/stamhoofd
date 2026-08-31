-- One row per member per group per scoutsjaar: the grain every figure in the report is counted from.
--
-- The scoutsjaar is the period's name, not its id. A registration points at the period of its own
-- organization, and every organization holds its own row for the same year, so the id identifies a
-- unit's year rather than the year itself. The name is what those rows share, which makes it the
-- only thing a national figure can group on. Imported years are single platform-wide rows and fall
-- out of the same rule.
--
-- A registration counts when it is active: not cancelled and actually registered. A member in two
-- groups appears twice here, so member counts are always COUNT(DISTINCT).
--
-- Which kinds of group count is the reader's, through `ingeschreven-voor.sql`: the ledenstatistieken
-- open on the leeftijdsgroepen alone and can be asked for the activiteiten and the wachtlijsten
-- beside them. `group_type` carries what that filter reads, so a card that may not be asked -- the
-- aanlevering, which is about leden of a jeugdbeweging and about nothing else -- says so itself.
--
-- Two columns say what a registration counts as, and they answer different questions.
-- `tak_category` is what the tak counts as -- kinderen, leiding or volwassenen -- as `takken.sql`
-- decides it, and is null wherever nobody has said. The aanlevering reads that one, and so do the
-- figures that weigh leiding against kinderen: a sheet delivered to a department may not guess, and a
-- division with leiding on one side cannot lean on a fallback that reads every young leider as a
-- kind. `effective_category` is that same answer with the fallbacks the ledenstatistieken need behind
-- it -- the tak's age range, and then the member's own age at the start of the year -- so that nobody
-- drops out of a total for want of a tak that was never categorised.
--
-- That last fallback catches what the import could not name. The client's export leaves the tak empty
-- on the children of the years before 2020-2021; the import reads those from the member's age, except
-- where a date of birth puts them outside every tak. Without the fallback each of those few counts
-- towards the total while showing up in none of the three categories. The handful of adults among
-- them stay null, because nothing here tells leiding from volwassenen.
--
-- Three names for the same rows, each one dropping something the one before it keeps:
--
--   * `all_registrations` is every registration of the werkjaar, the ones that were cancelled during
--     it included. Only the aanlevering reads it: the department counts everyone who was registered
--     at some point between september and august, not who was still registered in august.
--   * `all_facts` keeps the ones that are still active, which is what the report means by a lid.
--   * `facts` is that without the koepel's own organization. Every figure of the ledenstatistieken
--     is counted from it, through `leden.sql`, which narrows it to one row per member.
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
    WHERE r.registeredAt IS NOT NULL
      [[AND p.name = {{scoutsjaar}}]]
      [[AND o.name = {{eenheid}}]]
      -- @include aansluiting
      -- @include ingeschreven-voor
),
-- Where a registration that was cancelled during the year drops out. It stays a registration of that
-- werkjaar -- someone who left in november was a lid of that year -- but it is no longer one of the
-- registrations the ledenstatistieken count, which are the ones that are still standing.
all_facts AS (
    SELECT f.* FROM all_registrations f WHERE f.deactivated_at IS NULL
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
