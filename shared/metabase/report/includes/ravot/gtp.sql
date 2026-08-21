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
-- by. A kind of seventeen or older is in none of the buckets the formula names and weighs nothing
-- there, and a member whose date of birth is unknown has no age and falls outside them the same way.
--
-- Reads from `leden`, which holds one row per member per eenheid with what they are decided on it:
-- `tak_category` is the tak they were recorded in rather than their age, so a leider of sixteen
-- weighs as leiding and not as a kind of sixteen as well, and a kind of a group nobody has
-- categorised weighs nothing. Members registered at two eenheden still hold a row each, which is why
-- every term counts distinct members.
--
-- The omkaderingscijfer is the one from `../omkaderingscijfer.sql`, unrounded -- only what reaches
-- the screen is rounded. A unit without leiding has none, and NULLIF keeps the index null there
-- rather than letting the charts draw a zero.
ROUND(
          COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 10 THEN member_id END) / 3
        + COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd BETWEEN 10 AND 13 THEN member_id END)
        + 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd BETWEEN 14 AND 15 THEN member_id END)
        + 3 * COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd = 16 THEN member_id END)
        + 1.5 * COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END)
        - 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
