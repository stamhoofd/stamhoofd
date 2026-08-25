-- The takken every organization's groups map onto, as the report reads them: the rows of
-- `default_age_groups` with their category decided.
--
-- A fragment of its own because both grains of `facts` join it, and because it is where the one thing
-- about a tak that is neither synced nor derivable is settled -- see `tak-categorie.sql`. Everything
-- downstream reads it as `dag`, which is what `default_age_groups` was joined as before, so a tak's
-- name, ages and category are asked for the same way as ever.
--
-- Belongs at the head of a `WITH`, and carries the comma to whatever CTE follows it.
takken AS (
    SELECT
        dag.id,
        dag.periodId,
        dag.name,
        dag.minAge,
        dag.maxAge,
        -- @include tak-categorie
    FROM default_age_groups dag
),
