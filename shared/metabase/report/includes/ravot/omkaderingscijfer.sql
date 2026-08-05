-- The omkaderingscijfer as ravot counts it: how many kinderen a leider looks after on average.
--
--     Aantal kinderen jonger dan 17 / Aantal leiding
--
-- The same figure as `../omkaderingscijfer.sql` on the same rows, over fewer kinderen: ravot reads
-- the age of a lid rather than the tak they are in, here as in `gtp.sql` beside it, and counts only
-- the kinderen that index weighs. Low is good, and from 10 upwards keeping an eye on everyone gets
-- hard. Also the divisor of the GTP index, which takes it from here unrounded -- only what reaches
-- the screen is rounded here.
--
-- `leeftijd` is the age at the start of the werkjaar, the age the rest of the report charts members
-- by. A kind of seventeen or older weighs in no term of the index and is outside this division too,
-- and a member whose date of birth is unknown has no age and falls outside it the same way.
--
-- Counts the kinderen and the leiding of a categorised tak, so that nobody stands on both sides of
-- the division: someone who is leiding in one tak and lid in another is a leider here and not also
-- one of the children they look after. A member whose tak nobody has categorised is neither, and is
-- counted by the totals beside this rather than by the division -- which is why `Aantal kinderen`
-- divided by `Aantal leiding` off the same page comes out higher: those totals count a kind by the
-- category of their tak, so they hold the kinderen of seventeen and over as well.
--
-- Reads from `leden`, one row per member per eenheid, where that is decided.
ROUND(
        COUNT(DISTINCT CASE WHEN tak_category = 'child' AND leeftijd < 17 THEN member_id END)
        / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
