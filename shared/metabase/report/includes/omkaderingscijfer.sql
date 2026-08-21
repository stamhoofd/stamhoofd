-- The omkaderingscijfer: how many children a leider looks after on average.
--
--     Aantal kinderen / Aantal leiding
--
-- Low is good, and from 10 upwards keeping an eye on everyone gets hard.
--
-- Counts every kind the report knows of, so that nobody whose tak nobody has categorised drops out of
-- it. The GTP index subtracts an omkaderingscijfer of its own, over the kinderen of a categorised tak
-- alone (`gtp.sql`): the same figure wherever every tak is categorised, and a little lower where one
-- is not.
--
-- Reads from `facts`.
ROUND(
        COUNT(DISTINCT CASE WHEN effective_category = 'child' THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN effective_category = 'leader' THEN member_id END), 0), 2)
