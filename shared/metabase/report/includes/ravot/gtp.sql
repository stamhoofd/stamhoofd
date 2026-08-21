-- The GTP index (Gezond Toekomst Perspectief) as ravot weighs it.
--
--     leden < 10 / 3 + leden 10-13 + leden 14-15 * 2 + leden 16 * 3
--     + leiding * 1,5 - omkaderingscijfer * 2
--
-- The same index as `../gtp.sql` on the same rows, weighed differently: ravot reads the age of a lid
-- rather than the tak they are in, and counts a leider as one and a half.
--
-- A unit ideally scores 100 or more. The scale only says something up to roughly 150 members.
--
-- `leeftijd` is the age at the start of the werkjaar, the age the rest of the report charts members
-- by. Every bucket counts kinderen only, so a leider of sixteen weighs as leiding rather than as
-- both. A kind of seventeen or older is in none of the buckets the formula names and weighs nothing
-- there, while still counting towards the omkaderingscijfer, and a member whose date of birth is
-- unknown has no age and falls outside the buckets the same way.
--
-- The omkaderingscijfer is the one from `../omkaderingscijfer.sql`, unrounded -- only what reaches
-- the screen is rounded. A unit without leiding has none, and NULLIF keeps the index null there
-- rather than letting the charts draw a zero.
--
-- Reads from `facts`, where a member registered in two groups holds two rows, so every term counts
-- distinct members.
ROUND(
          COUNT(DISTINCT CASE WHEN effective_category = 'child' AND leeftijd < 10 THEN member_id END) / 3
        + COUNT(DISTINCT CASE WHEN effective_category = 'child' AND leeftijd BETWEEN 10 AND 13 THEN member_id END)
        + 2 * COUNT(DISTINCT CASE WHEN effective_category = 'child' AND leeftijd BETWEEN 14 AND 15 THEN member_id END)
        + 3 * COUNT(DISTINCT CASE WHEN effective_category = 'child' AND leeftijd = 16 THEN member_id END)
        + 1.5 * COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END)
        - 2 * COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END), 0), 2)
