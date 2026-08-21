-- The GTP index (Gezond Toekomst Perspectief).
--
--     Bevers / 3 + Eekhoorns / 3 + Welpen / 3 + Wolven + JVG/JG-A + VG/G-J * 2 + Seniors * 3
--     + leiding - omkaderingscijfer * 2
--
-- A unit ideally scores 100 or more. The scale only says something up to roughly 150 members.
--
-- Not every platform weighs the index this way: ravot reads the age of a lid rather than the tak, in
-- `ravot/gtp.sql`, which is what `@include gtp` expands to there.
--
-- The takken are the ones the platform defines, matched on the name they carry in
-- `default_age_groups`. Every group that is a tak points at one of those rows, so `Tak` is that name
-- rather than whatever an eenheid called its own group. `tak_category` says the same thing from the
-- other side: a group pointing at no such row is categorised as nothing, and a group an eenheid named
-- `Bevers` itself weighs nothing rather than weighing as the tak it is named after.
--
-- Eekhoorns and Wolven are not named by the client's formula. Eekhoorns weigh a third, with the
-- takken of the same ages; Wolven weigh one, like the JVG/JG-A they sit just below.
--
-- Reads from `gtp_leden`, which holds one row per member per eenheid: the tak a member counts under
-- is decided there, so nobody is weighed in two terms at once and leiding weigh as leiding only.
-- Members registered at two eenheden still hold a row each, which is why every term counts distinct
-- members.
--
-- What the years before 2020-2021 weigh rests on the import: the client's export names no tak on the
-- children of those years, and the import reads one from their age. The few it could not place --
-- a date of birth that falls outside every tak -- point at no tak and are categorised as nothing, so
-- they weigh nothing here, while the omkaderingscijfer on the screen still counts them.
--
-- The omkaderingscijfer here is the kinderen of a categorised tak over that same leiding, unrounded
-- -- only what reaches the screen is rounded. It is therefore not to the last digit the figure
-- `omkaderingscijfer.sql` puts on the screen beside it, which counts every kind the report knows of.
-- A unit without leiding has none, and NULLIF keeps the index null there rather than letting the
-- charts draw a zero.
ROUND(
          ( COUNT(DISTINCT CASE WHEN tak_category = 'child' AND `Tak` = 'Bevers' THEN member_id END)
          + COUNT(DISTINCT CASE WHEN tak_category = 'child' AND `Tak` = 'Eekhoorns' THEN member_id END)
          + COUNT(DISTINCT CASE WHEN tak_category = 'child' AND `Tak` = 'Welpen' THEN member_id END) ) / 3
        + COUNT(DISTINCT CASE WHEN tak_category = 'child' AND `Tak` = 'Wolven' THEN member_id END)
        + COUNT(DISTINCT CASE WHEN tak_category = 'child' AND `Tak` = 'Jongverkenners/Jonggidsen - Aspiranten' THEN member_id END)
        + 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' AND `Tak` = 'Verkenners/Gidsen - Juniors' THEN member_id END)
        + 3 * COUNT(DISTINCT CASE WHEN tak_category = 'child' AND `Tak` = 'Seniors' THEN member_id END)
        + COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END)
        - 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
