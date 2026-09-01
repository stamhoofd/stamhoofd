-- description: Of het lid (all_registrations) in dat werkjaar een aansluiting heeft die de aanlevering meetelt.
EXISTS (
    SELECT 1
    FROM member_platform_memberships
    WHERE member_platform_memberships.memberId = all_registrations.member_id
      AND member_platform_memberships.periodId = all_registrations.period_id
      AND member_platform_memberships.deletedAt IS NULL
      AND (
          -- @include filter-delivery-memberships
      )
)
