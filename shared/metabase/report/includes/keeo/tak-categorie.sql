-- The takken of keeo, by the id they carry in the platform configuration.
--
-- Said here rather than in a hand-filled column of the statistics database, so that the answer lives
-- with the report instead of in a database nobody can read back: such a column survives no rebuild,
-- and setting it again means an UPDATE nothing records. Written out in the query, it also stands in
-- front of whoever opens the question in Metabase, who can correct a tak there and tell us after.
--
-- The id rather than the name: a tak holds a row per year, and a rename would silently drop it out of
-- the list in the year it happened. Ordered as the report divides them.
--
-- This is the whole answer, so a tak of keeo that is missing here counts as nothing at all: it is
-- held by the totals but by none of the three categories, and by no figure that divides leiding from
-- kinderen. A tak added to the platform configuration has to be added here as well.
CASE dag.id
    -- Kinderen
    WHEN 'f274a949-9318-4c2b-ae35-e50114efe686' THEN 'child'   -- Bevers of Zeehonden
    WHEN '316ea554-675a-493e-a152-365012851ae3' THEN 'child'   -- Welpen
    WHEN '01d62f7d-c3fa-4314-a33a-21da526a35ff' THEN 'child'   -- Wolven
    WHEN '57143f32-e4d2-46a7-96e2-9bf82f121e1c' THEN 'child'   -- Jongverkenners, Jonggidsen, JVG's of Aspiranten
    WHEN '0eacf56f-3a1d-4e15-bebc-2bc66fc74c7a' THEN 'child'   -- Verkenners, Gidsen, VG's of Juniors
    WHEN 'b2275ec6-04ad-4232-bfe3-0eefed97f83b' THEN 'child'   -- Seniors
    -- Leiding
    WHEN 'b90e0833-7047-4283-8e25-cd65c5f09129' THEN 'leader'  -- Leiding
    -- Volwassenen
    WHEN '6fc0775e-2851-4fe1-90cd-af9c74243ccd' THEN 'adult'   -- Stam
    WHEN '77c2530c-2834-4da3-83c5-1cff9cf05c7e' THEN 'adult'   -- Nationaal vrijwilligers
    WHEN 'd4bb14bf-4a52-44e4-a014-3333c5ebb36a' THEN 'adult'   -- Nationaal vrijwilligers, rechtstreeks aan FOS
    WHEN '8d42d2df-7787-4959-995d-c5a85d0e48c9' THEN 'adult'   -- Ereleden
    WHEN 'ac8848e9-9868-44a1-a057-2a189cce68ea' THEN 'adult'   -- Ondersteunende leden, VZW, Steuncomité of Helpende handen
END AS category
