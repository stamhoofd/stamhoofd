, leden AS (
    SELECT g.* FROM (
        SELECT
            f.*,
            ROW_NUMBER() OVER (
                PARTITION BY f.organization_id, f.`Scoutsjaar`, f.member_id
                ORDER BY
                    (f.deactivated_at IS NULL) DESC,
                    CASE f.tak_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC,
                    CASE f.effective_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC,
                    f.tak_min_age DESC,
                    f.`Tak`
            ) AS rang
        FROM facts f
        WHERE EXISTS (
            SELECT 1
            FROM member_platform_memberships mpm
            WHERE mpm.memberId = f.member_id
              AND mpm.periodId = f.period_id
              AND mpm.deletedAt IS NULL
              -- @include ledenstatistieken-aansluitingen
        )
    ) g
    WHERE g.rang = 1
)
