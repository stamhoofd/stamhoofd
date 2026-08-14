-- The GTP waarden: every child weighs according to its tak, plus the leiding.
--
--     Bevers * 3 + Welpen * 3 + JVG/JG-A + VG/G-J * 2 + Seniors * 3 + leiding
--
-- A tak is recognised by the lower bound of its age range rather than by its name. Every eenheid
-- names its own groups, and `default_age_groups`.`name` holds the tak as the platform spells it
-- ("Jonggidsen en Jongverkenners"), not the abbreviation the formula uses. The age range is the one
-- thing that is the same platform wide: Bevers and Welpen up to 10, JVG/JG-A from 11, VG/G-J from
-- 14, Seniors from 17 -- the same boundaries the rest of the report already counts on.
--
-- Falls back to the member's own age when the tak has no range. The imported years put every child
-- in a nameless tak without one (see `facts.sql`), and without this none of those children would
-- weigh anything at all.
--
-- Reads from `facts`, where a member registered in two groups holds two rows, so every term counts
-- distinct members.
      3 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) <= 10 THEN member_id END)
    + 1 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) BETWEEN 11 AND 13 THEN member_id END)
    + 2 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) BETWEEN 14 AND 16 THEN member_id END)
    + 3 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) >= 17 THEN member_id END)
    + COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END)
