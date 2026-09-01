-- description: Eén rij per lid per eenheid voor het gekozen werkjaar: de inschrijving die voor het lid spreekt. Leiding wint van lid, de oudste leeftijdsgroep wint bij twee.
WITH non_platform_registrations AS (
    -- @include all-non-platform-registrations
)
-- Identical to `deduplicated-non-platform-registrations-all-years.sql` apart from the grain it reads; a test keeps the two in step.
SELECT deduplicated.* FROM (
    SELECT
        non_platform_registrations.*,
        ROW_NUMBER() OVER (
            PARTITION BY non_platform_registrations.organization_id, non_platform_registrations.`Werkjaar`, non_platform_registrations.member_id
            ORDER BY
                (non_platform_registrations.deactivated_at IS NULL) DESC,
                CASE non_platform_registrations.age_group_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC,
                CASE non_platform_registrations.effective_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC,
                non_platform_registrations.age_group_min_age DESC,
                non_platform_registrations.`Leeftijdsgroep`
        ) AS rang
    FROM non_platform_registrations
    WHERE EXISTS (
        SELECT 1
        FROM member_platform_memberships
        WHERE member_platform_memberships.memberId = non_platform_registrations.member_id
          AND member_platform_memberships.periodId = non_platform_registrations.period_id
          AND member_platform_memberships.deletedAt IS NULL
          AND (
              -- @include filter-statistics-memberships
          )
    )
) deduplicated
WHERE deduplicated.rang = 1
