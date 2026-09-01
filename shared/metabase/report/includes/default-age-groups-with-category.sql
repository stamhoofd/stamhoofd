-- description: Elke leeftijdsgroep van het platform, met de categorie die zegt wat hij telt als.
SELECT
    default_age_groups.id,
    default_age_groups.periodId,
    default_age_groups.name,
    default_age_groups.minAge,
    default_age_groups.maxAge,
    -- @include default-age-group-category
        AS category
FROM default_age_groups
