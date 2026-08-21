-- One row per member per eenheid per scoutsjaar: what someone is, decided once, before the figures
-- that weigh leiding against kinderen count them.
--
-- `facts` holds a row per registration, so a member registered in two takken of the same eenheid
-- stands in it twice. Counted as they stand there, someone who is leiding in one tak and lid in
-- another is counted as both -- in the omkaderingscijfer as a kind and as the leider they are
-- divided by at once -- and the GTP index weighs such a member in two of its terms. This picks the
-- one registration that says what they are, the way `jeugdbewegingen.sql` picks it for the
-- aanlevering: leiding beats lid, and between two takken the oldest one wins, since that is the one a
-- member has grown into. The name of the tak breaks a tie no age can, so that two runs of the same
-- query cannot pick differently.
--
-- What a member is comes from `tak_category`, what the tak was recorded as, and never from
-- `effective_category`, which falls back to the member's own age. That fallback cannot tell leiding
-- from anything, so a leider of sixteen would read as a kind and be counted on both sides of the same
-- division. It does decide between two rows that the takken leave equally unsaid, so that a member
-- whose only reading is the fallback keeps it rather than losing it to whichever row sorted first.
--
-- Every member keeps a row, whether their tak is categorised or not, and every row keeps both
-- columns: a card that counts kinderen the way the totals do goes on reading `effective_category`
-- here, and only counts a member once now.
--
-- Belongs after `facts` or `facts-alle-jaren`, whichever grain the card reads.
, leden AS (
    SELECT g.* FROM (
        SELECT
            f.*,
            ROW_NUMBER() OVER (
                PARTITION BY f.organization_id, f.`Scoutsjaar`, f.member_id
                ORDER BY
                    CASE f.tak_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC,
                    CASE f.effective_category WHEN 'leader' THEN 3 WHEN 'child' THEN 2 WHEN 'adult' THEN 1 ELSE 0 END DESC,
                    f.tak_min_age DESC,
                    f.`Tak`
            ) AS rang
        FROM facts f
    ) g
    WHERE g.rang = 1
)
