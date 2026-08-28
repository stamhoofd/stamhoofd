-- The omkaderingscijfer: how many children a leider looks after on average.
--
--     Aantal kinderen / Aantal leiding
--
-- Low is good, and from 10 upwards keeping an eye on everyone gets hard. Also the divisor of the GTP
-- index, which takes it from here unrounded -- only what reaches the screen is rounded here.
--
-- Counts the kinderen and the leiding of a categorised tak, so that nobody stands on both sides of
-- the division: someone who is leiding in one tak and lid in another is a leider here and not also
-- one of the children they look after. A member whose tak nobody has categorised is neither, and is
-- counted by the totals beside this rather than by the division -- which is why `Aantal kinderen`
-- divided by `Aantal leiding` off the same page can come out slightly higher.
--
-- Reads from `leden`, one row per member per eenheid, where that is decided.
ROUND(
        COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
