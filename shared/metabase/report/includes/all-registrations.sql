-- description: Eén rij per inschrijving, de eigen organisatie van de koepel inbegrepen: wie waar ingeschreven was, in welke leeftijdsgroep, in welk werkjaar.
WITH default_age_groups_with_category AS (
    -- @include default-age-groups-with-category
)
SELECT
    registrations.memberId AS member_id,
    registrations.organizationId AS organization_id,
    organizations.uri AS organization_uri,
    organizations.name AS `Eenheid`,
    organizations.postalCode AS eenheid_postcode,
    organizations.city AS eenheid_gemeente,
    registration_periods.id AS period_id,
    registration_periods.name AS `Werkjaar`,
    registration_periods.startDate AS period_start,
    `groups`.type AS group_type,
    COALESCE(default_age_groups_with_category.name, `groups`.name) AS `Leeftijdsgroep`,
    default_age_groups_with_category.id AS age_group_id,
    default_age_groups_with_category.category AS age_group_category,
    default_age_groups_with_category.minAge AS age_group_min_age,
    default_age_groups_with_category.maxAge AS age_group_max_age,
    COALESCE(
        default_age_groups_with_category.category,
        CASE WHEN default_age_groups_with_category.maxAge < 18 THEN 'child' END,
        CASE WHEN TIMESTAMPDIFF(YEAR, members.birthDate, registration_periods.startDate) < 18 THEN 'child' END
    ) AS effective_category,
    CASE members.gender
        WHEN 'Male' THEN 'Man'
        WHEN 'Female' THEN 'Vrouw'
        WHEN 'Other' THEN 'Andere'
        ELSE 'Onbekend'
    END AS `Geslacht`,
    members.birthDate AS birth_date,
    TIMESTAMPDIFF(YEAR, members.birthDate, registration_periods.startDate) AS leeftijd,
    members.postalCode AS postcode,
    registrations.deactivatedAt AS deactivated_at
FROM registrations
JOIN registration_periods ON registration_periods.id = registrations.periodId
JOIN `groups` ON `groups`.id = registrations.groupId AND `groups`.deletedAt IS NULL
-- The leeftijdsgroep, the member and the eenheid are each recorded per year, so the period is part of what
-- identifies the row to join to: a leeftijdsgroep that is renamed or a member who moves changes the year it
-- happened in, not every year they were ever counted in.
LEFT JOIN default_age_groups_with_category
    ON default_age_groups_with_category.id = `groups`.defaultAgeGroupId
    AND default_age_groups_with_category.periodId = registrations.periodId
JOIN members ON members.id = registrations.memberId AND members.periodId = registrations.periodId
JOIN organizations ON organizations.id = registrations.organizationId AND organizations.periodId = registrations.periodId
    AND organizations.active = 1
WHERE registrations.registeredAt IS NOT NULL
  AND registration_periods.name = {{werkjaar}}
  [[AND organizations.name = {{eenheid}}]]
  AND (
      -- @include filter-registration-types
  )
