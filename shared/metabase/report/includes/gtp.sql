-- The GTP index (Gezond Toekomst Perspectief).
--
--     Bevers / 3 + Eekhoorns / 3 + Welpen / 3 + Wolven + JVG/JG-A + VG/G-J * 2 + Seniors * 3
--     + leiding - omkaderingscijfer * 2
--
-- A unit ideally scores 100 or more. The scale only says something up to roughly 150 members.
--
-- The takken are the ones the platform defines, matched on the name they carry in
-- `default_age_groups`. Every group that is a tak points at one of those rows, so `Tak` is that name
-- rather than whatever an eenheid called its own group -- the only groups not pointing at one are
-- the nameless imported ones below.
--
-- Eekhoorns and Wolven are not named by the client's formula. Eekhoorns weigh a third, with the
-- takken of the same ages; Wolven weigh one, like the JVG/JG-A they sit just below.
--
-- Leiding comes from the categorie instead, which is set on the Leiding tak and nothing else, so it
-- is the same members either way and the omkaderingscijfer below divides by the same count.
--
-- The years before 2020-2021 weigh nothing but their leiding: those were imported with every child
-- in a nameless tak (see `facts.sql`), and there is no tak there to weigh.
--
-- The omkaderingscijfer is the one from `omkaderingscijfer.sql`, unrounded -- only what reaches the
-- screen is rounded. A unit without leiding has none, and NULLIF keeps the index null there rather
-- than letting the charts draw a zero.
--
-- Reads from `facts`, where a member registered in two groups holds two rows, so every term counts
-- distinct members.
ROUND(
          ( COUNT(DISTINCT CASE WHEN `Tak` = 'Bevers' THEN member_id END)
          + COUNT(DISTINCT CASE WHEN `Tak` = 'Eekhoorns' THEN member_id END)
          + COUNT(DISTINCT CASE WHEN `Tak` = 'Welpen' THEN member_id END) ) / 3
        + COUNT(DISTINCT CASE WHEN `Tak` = 'Wolven' THEN member_id END)
        + COUNT(DISTINCT CASE WHEN `Tak` = 'Jongverkenners/Jonggidsen - Aspiranten' THEN member_id END)
        + 2 * COUNT(DISTINCT CASE WHEN `Tak` = 'Verkenners/Gidsen - Juniors' THEN member_id END)
        + 3 * COUNT(DISTINCT CASE WHEN `Tak` = 'Seniors' THEN member_id END)
        + COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END)
        - 2 * COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END)
            / NULLIF(COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END), 0), 2)
