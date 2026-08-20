-- The omkaderingscijfer: how many children a leider looks after on average.
--
--     Aantal kinderen / Aantal leiding
--
-- Low is good, and from 10 upwards keeping an eye on everyone gets hard. Also the divisor of the GTP
-- index, which takes it from `gtp.sql` unrounded -- only what reaches the screen is rounded here.
--
-- Reads from `facts`.
ROUND(
        COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END), 0), 2)
