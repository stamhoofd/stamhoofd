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
-- The takken are matched on `tak_id`, the id of the row in `default_age_groups` a group points at,
-- which is the same id `keeo/tak-categorie.sql` names them by. Not on the name, which the takken were
-- weighed by until it turned out to weigh almost nothing: the client's formula spells them as its own
-- system does -- `Jongverkenners/Jonggidsen - Aspiranten` against the platform's `Jongverkenners,
-- Jonggidsen, JVG's of Aspiranten` -- and three of the terms matched no tak at all. A name is also
-- what a tak carries per year, so a rename would drop it out of the index in the year it happened.
--
-- A group pointing at no tak has no id and weighs nothing, which is what keeps a group an eenheid
-- named `Bevers` itself from weighing as the tak it is named after. That makes asking for the category
-- as well unnecessary: an id is one tak, and `keeo/tak-categorie.sql` is what says that tak is
-- kinderen.
--
-- Eekhoorns and Wolven are not named by the client's formula. Wolven weigh one, like the JVG/JG-A they
-- sit just below. Eekhoorns weigh a third, with the takken of the same ages, and need no term of their
-- own: the platform holds one tak for the Bevers and the Zeehonden that an eenheid's Eekhoorns are
-- registered in, so the first term already counts them.
--
-- Reads from `leden`, which holds one row per member per eenheid: the tak a member counts under is
-- decided there, so nobody is weighed in two terms at once and leiding weigh as leiding only.
-- Members registered at two eenheden still hold a row each, which is why every term counts distinct
-- members.
--
-- What the years before 2020-2021 weigh rests on the import: the client's export names no tak on the
-- children of those years, and the import reads one from their age. The few it could not place --
-- a date of birth that falls outside every tak -- point at no tak and weigh nothing here.
--
-- The omkaderingscijfer is the one from `omkaderingscijfer.sql`, unrounded -- only what reaches the
-- screen is rounded. A unit without leiding has none, and NULLIF keeps the index null there rather
-- than letting the charts draw a zero.
ROUND(
          ( COUNT(DISTINCT CASE WHEN tak_id = 'f274a949-9318-4c2b-ae35-e50114efe686' THEN member_id END)  -- Bevers of Zeehonden, which an eenheid's Eekhoorns are registered in
          + COUNT(DISTINCT CASE WHEN tak_id = '316ea554-675a-493e-a152-365012851ae3' THEN member_id END) ) / 3  -- Welpen
        + COUNT(DISTINCT CASE WHEN tak_id = '01d62f7d-c3fa-4314-a33a-21da526a35ff' THEN member_id END)  -- Wolven
        + COUNT(DISTINCT CASE WHEN tak_id = '57143f32-e4d2-46a7-96e2-9bf82f121e1c' THEN member_id END)  -- Jongverkenners, Jonggidsen, JVG's of Aspiranten
        + 2 * COUNT(DISTINCT CASE WHEN tak_id = '0eacf56f-3a1d-4e15-bebc-2bc66fc74c7a' THEN member_id END)  -- Verkenners, Gidsen, VG's of Juniors
        + 3 * COUNT(DISTINCT CASE WHEN tak_id = 'b2275ec6-04ad-4232-bfe3-0eefed97f83b' THEN member_id END)  -- Seniors
        + COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END)
        - 2 * COUNT(DISTINCT CASE WHEN tak_category = 'child' THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN tak_category = 'leader' THEN member_id END), 0), 2)
