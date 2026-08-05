-- What a deelnemer of a lokale groep is delivered as, as ravot counts it: the same as
-- `../type-deelnemers.sql` with the ondersteunende leden among the leiding.
--
-- Ondersteunende leden are volwassenen who carry a group rather than a tak of kinderen, and the
-- metadatafiche counts the volwassen begeleiders, kassabeheerders and secretarissen of a group as
-- leiding -- the department has no third word for them. The tak is not categorised as leiding, and
-- may not be: the omkaderingscijfer and the GTP index would then read it as leiding the kinderen of
-- an eenheid are looked after by. The aanlevering therefore names the tak itself.
--
-- Named by `tak_id`, the id of the row in `default_age_groups`, the way `gtp.sql` weighs the takken
-- it names: a name is what a tak carries per year, so a rename would stop delivering it in the year
-- it happened. The id is the one `tak-categorie.sql` beside this names it by.
--
-- A group an eenheid named `Ondersteunende leden` itself points at no tak, so it carries no id and is
-- delivered as neither. Under the name it was matched by before, such a group was delivered as
-- leiding.
CASE
    WHEN f.tak_category = 'leader' THEN 2
    WHEN f.tak_id = 'a28d290c-af71-4282-92cc-2224a18d3091' THEN 2  -- Ondersteunende leden
    WHEN f.tak_category = 'child' THEN 1
    ELSE 0
END
