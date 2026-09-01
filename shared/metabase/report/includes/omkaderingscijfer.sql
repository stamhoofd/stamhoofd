-- The omkaderingscijfer: how many children a leider looks after on average.
-- Aantal kinderen / Aantal leiding
ROUND(
        COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
