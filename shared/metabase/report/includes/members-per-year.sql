-- description: Wie in welk werkjaar lid was, waar op het platform ook; de eigen organisatie van de koepel volgt de dashboardfilter. Wie naar een andere eenheid verhuist, blijft voor het ledenbehoud meetellen.
SELECT DISTINCT
    registrations.memberId AS member_id,
    registration_periods.name AS `Werkjaar`
FROM registrations
JOIN registration_periods ON registration_periods.id = registrations.periodId
JOIN `groups` ON `groups`.id = registrations.groupId AND `groups`.deletedAt IS NULL
WHERE registrations.registeredAt IS NOT NULL
  -- Someone left with only a registration at the koepel is only a blijver when that organization is included.
  AND (
      {{platformleden_opnemen}}
      OR NOT EXISTS (SELECT 1 FROM platform WHERE platform.membershipOrganizationId = registrations.organizationId)
  )
  AND (
      -- @include filter-registration-types
  )
  AND EXISTS (
      SELECT 1
      FROM member_platform_memberships
      WHERE member_platform_memberships.memberId = registrations.memberId
        AND member_platform_memberships.periodId = registrations.periodId
        AND member_platform_memberships.deletedAt IS NULL
        AND (
            -- @include filter-statistics-memberships
        )
  )
