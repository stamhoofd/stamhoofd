-- The takken every organization's groups map onto, as the report reads them: the rows of
-- `default_age_groups` with their category decided.
--
-- A fragment of its own because both grains of `facts` join it, and because it is where the one thing
-- about a tak that is neither synced nor derivable is settled -- see `tak-categorie.sql`. `category`
-- is no column of `default_age_groups`: it is added here, which is why the takken are read through
-- this rather than joined straight from the table. Everything downstream reads it as `dag`, so a
-- tak's name, ages and category are asked for the same way.
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
