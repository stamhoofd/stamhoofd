import type { RelationFilterOption } from './RelationUIFilter';

function hasOption<T extends string | number | Date | null | boolean>(options: RelationFilterOption<T>[], option: RelationFilterOption<T>) {
    return options.some(o => o.value === option.value && o.name === option.name);
}

function filterDistinctOptions<T extends string | number | Date | null | boolean>(sourceOptions: RelationFilterOption<T>[], optionsToFilter: RelationFilterOption<T>[]) {
    return optionsToFilter.filter(option => !hasOption(sourceOptions, option));
}

export function getRelationFilterDisplayOptions<T extends string | number | Date | null | boolean>({
    defaultOptions,
    selectedOptions,
    asyncOptions,
}: {
    defaultOptions: RelationFilterOption<T>[];
    selectedOptions: RelationFilterOption<T>[];
    asyncOptions: RelationFilterOption<T>[];
}): { pinnedOptions: RelationFilterOption<T>[]; regularOptions: RelationFilterOption<T>[] } {
    // Keep visible async options in their loaded order. Example: selecting "Group B" in
    // [Group A, Group B, Group C] should not move it above Group A; only selected
    // options that are not in the current async results are pinned here.
    const invisibleSelectedOptions = filterDistinctOptions(
        defaultOptions.concat(asyncOptions),
        selectedOptions,
    );

    const pinnedOptions = defaultOptions.concat(invisibleSelectedOptions);

    return {
        pinnedOptions,
        regularOptions: filterDistinctOptions(pinnedOptions, asyncOptions),
    };
}
