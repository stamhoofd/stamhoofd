-- The omkaderingscijfer as ravot counts it: how many kinderen a leider looks after on average.
--
--     Aantal kinderen jonger dan 17 / Aantal leiding
ROUND(
        COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 17 THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
