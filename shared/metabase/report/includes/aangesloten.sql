EXISTS (
    SELECT 1
    FROM member_platform_memberships mpm
    WHERE mpm.memberId = f.member_id
      AND mpm.periodId = f.period_id
      AND mpm.deletedAt IS NULL
      -- @include aanlevering-aansluitingen
)
