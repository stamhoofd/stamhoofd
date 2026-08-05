-- Whether the member of a registration was aangesloten in the year that registration belongs to: a
-- lidgeld recorded against that period which was not deleted again.
--
-- What the aanlevering counts as ingeschreven. Being registered at a group is not enough on its own:
-- a koepel delivers the deelnemers it aansluit, and a registration that never became an aansluiting
-- is a member of the group rather than of the jeugdbeweging.
--
-- Not deleted is the whole of what makes it count. A lidgeld whose expireDate has passed, or one that
-- never left its proefperiode, still says the member was aangesloten during that werkjaar, which is
-- the question the dataset asks -- not whether the koepel still holds them today.
--
-- Not to be confused with `aansluiting.sql`, the filter above the dashboards: that one narrows to the
-- types the reader picked and disappears when they pick none. This is a condition of the sheets
-- themselves and always holds.
--
-- Belongs in a WHERE clause on rows of `all_registrations`, `all_facts` or `facts` aliased as `f`.
EXISTS (
    SELECT 1
    FROM member_platform_memberships mpm
    WHERE mpm.memberId = f.member_id
      AND mpm.periodId = f.period_id
      AND mpm.deletedAt IS NULL
)
