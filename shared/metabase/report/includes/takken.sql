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
