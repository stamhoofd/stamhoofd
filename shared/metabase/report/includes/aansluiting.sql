-- Which aansluiting a member holds, as the filter above the dashboards asks it: a registration counts
-- when its member holds one of the chosen types in the year that registration is in.
--
-- Nothing chosen drops the whole clause, which is what leaves every member in -- including everyone
-- holding no aansluiting at all. That is the state the dashboards open in.
--
-- `IN` rather than `=`, because several types can be chosen at once: Metabase writes a multi-value
-- filter out as the values it was given, comma separated.
--
-- On the name of the type rather than its id: a type holds a row per year under one id, and the name
-- is what the filter lists, the same way the scoutsjaar and the eenheid are filtered by name.
--
-- Where the aansluiting was recorded is deliberately not part of it. The koepel records one on its
-- own structuurvrijwilligers too, and `all_facts` is read by the sheet that counts exactly those,
-- which an organization condition here would empty.
--
-- Belongs in a WHERE clause that has the registration as `r`.
[[AND EXISTS (
    SELECT 1
    FROM member_platform_memberships mpm
    JOIN platform_membership_types mt ON mt.id = mpm.membershipTypeId AND mt.periodId = mpm.periodId
    WHERE mpm.memberId = r.memberId
      AND mpm.periodId = r.periodId
      AND mpm.deletedAt IS NULL
      AND mt.name IN ({{aansluiting}})
)]]
