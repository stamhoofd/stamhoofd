-- The GTP index (Gezond Toekomst Perspectief).
--
--     leden < 10 jaar / 3 + leden 10-13 jaar + leden 14-15 jaar * 2 + leden 16 jaar * 3
--     + leiding - omkaderingscijfer / 2
--
-- A unit ideally scores 100 or more. The scale only says something up to roughly 150 members.
--
-- Counts by the member's own age at the start of the scoutsjaar, not by the tak they sit in. That
-- is what carries the imported years, where every child is in a nameless tak with no age range at
-- all (see `facts.sql`) but does have a date of birth.
--
-- The bands cover kinderen only. A leider under 18 falls inside one of them, and counting them there
-- as well as in the leiding term would weigh them twice.
--
-- The top band is every child of 16 and over, not the sixteen-year-olds alone: Seniors run to 17,
-- and 176 of them were 17 in 2023-2024, who would otherwise weigh nothing.
--
-- The omkaderingscijfer is the one from `omkaderingscijfer.sql`, unrounded -- only what reaches the
-- screen is rounded. A unit without leiding has none, and NULLIF keeps the index null there rather
-- than letting the charts draw a zero.
--
-- Reads from `facts`, where a member registered in two groups holds two rows, so every term counts
-- distinct members.
ROUND(
          COUNT(DISTINCT CASE WHEN categorie = 'child' AND leeftijd < 10 THEN member_id END) / 3
        + COUNT(DISTINCT CASE WHEN categorie = 'child' AND leeftijd BETWEEN 10 AND 13 THEN member_id END)
        + 2 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND leeftijd BETWEEN 14 AND 15 THEN member_id END)
        + 3 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND leeftijd >= 16 THEN member_id END)
        + COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END)
        - COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END), 0) / 2, 2)
