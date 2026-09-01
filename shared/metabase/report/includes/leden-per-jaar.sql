, leden_per_jaar AS (
    SELECT DISTINCT
        r.memberId AS member_id,
        p.name AS `Scoutsjaar`
    FROM registrations r
    JOIN registration_periods p ON p.id = r.periodId
    JOIN `groups` g ON g.id = r.groupId AND g.deletedAt IS NULL
    WHERE r.registeredAt IS NOT NULL
      -- Wie het jaar erna alleen nog bij de koepel zelf ingeschreven staat is geen blijver: dat is
      -- dezelfde organisatie die `facts` weglaat, en een cijfer dat hier wel meetelt en daar niet zou
      -- een ledenbehoud boven de leden zetten waar het over gaat.
      AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = r.organizationId)
      -- @include inschrijvingen
      AND EXISTS (
          SELECT 1
          FROM member_platform_memberships mpm
          WHERE mpm.memberId = r.memberId
            AND mpm.periodId = r.periodId
            AND mpm.deletedAt IS NULL
            -- @include ledenstatistieken-aansluitingen
      )
)
