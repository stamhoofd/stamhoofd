-- One row per member per eenheid per scoutsjaar: what someone is, decided once, before the GTP index
-- weighs them.
--
-- `facts` holds a row per registration, so a member registered in two takken of the same eenheid
-- stands in it twice. Weighed as they stand there, that member is counted in two terms of the index
-- at once, and someone who is leiding in one tak and lid in another is counted as both. This picks
-- the one registration that says what they are, the way `jeugdbewegingen.sql` picks it for the
-- aanlevering: leiding beats lid, and between two takken the oldest one wins, since that is the one a
-- member has grown into. The name of the tak breaks a tie no age can, so that two runs of the same
-- query cannot pick differently.
--
-- What a member is comes from `tak_category`, what the tak was recorded as, and never from
-- `effective_category`, which falls back to the member's own age so that nobody drops out of a total.
-- That fallback is right for a total and wrong here: it reads a kind out of a group nobody has
-- categorised, and an age cannot tell leiding from anything, so a leider of sixteen would read as a
-- kind and weigh in the index twice over.
--
-- Every member keeps a row, whether their tak is categorised or not, so a card that counts leden
-- beside the index still counts all of them. It is the index that leaves out what no tak categorises.
--
-- Belongs after `facts` or `facts-alle-jaren`, whichever grain the card reads.
, gtp_leden AS (
    SELECT g.* FROM (
        SELECT
            f.*,
            ROW_NUMBER() OVER (
                PARTITION BY f.organization_id, f.`Scoutsjaar`, f.member_id
                ORDER BY
                    CASE f.tak_category WHEN 'leader' THEN 2 WHEN 'child' THEN 1 ELSE 0 END DESC,
                    f.tak_min_age DESC,
                    f.`Tak`
            ) AS gtp_rang
        FROM facts f
    ) g
    WHERE g.gtp_rang = 1
)
