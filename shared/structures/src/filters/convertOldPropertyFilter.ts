import { PropertyFilter } from './PropertyFilter.js';
import { StamhoofdFilter } from './StamhoofdFilter.js';

// todo: remove after migration

// #region types
enum NumberFilterMode {
    GreaterThan = 'GreaterThan',
    LessThan = 'LessThan',
    Between = 'Between',
    NotBetween = 'NotBetween',
    Equal = 'Equal',
    NotEqual = 'NotEqual',
}

interface NumberFilter {
    definitionId: string;
    mode: NumberFilterMode;
    start?: number;
    end?: number;
}

enum StringFilterMode {
    Contains = 'Contains',
    Equals = 'Equals',
    NotContains = 'NotContains',
    NotEquals = 'NotEquals',
    NotEmpty = 'NotEmpty',
    Empty = 'Empty',
}

interface StringFilter {
    definitionId: string;
    value: string;
    mode: StringFilterMode;
}

enum ChoicesFilterMode {
    Or = 'Or',
    And = 'And',
    /**
     * Means !(A || B) == !A && !B
     */
    Nor = 'Nor',
    /**
     * Means !(A && B) == !A || !B
     */
    Nand = 'Nand',
}

interface ChoicesFilter {
    definitionId: string;
    choiceIds: string[];
    mode: ChoicesFilterMode;
}

enum DateFilterMode {
    GreaterThan = 'GreaterThan',
    LessThan = 'LessThan',
    Between = 'Between',
    NotBetween = 'NotBetween',
    Equal = 'Equal',
    NotEqual = 'NotEqual',
}

interface DateFilter {
    definitionId: string;
    mode: DateFilterMode;
    minimumDate?: number;
    maximumDate?: number;
}

enum GroupFilterMode {
    Or = 'Or',
    And = 'And',
    /**
     * Means !(A || B) == !A && !B
     */
    Nor = 'Nor',
    /**
     * Means !(A && B) == !A || !B
     */
    Nand = 'Nand',
}

interface FilterGroup {
    definitionId: string;
    filters: Filter[];
    mode: GroupFilterMode;
}

interface FilterGroupEncoded {
    data: Filter;
    version: number;
}

interface OldPropertyFilter {
    enabledWhen: FilterGroupEncoded;
    requiredWhen: FilterGroupEncoded | null;

}

enum RegistrationsFilterMode {
    Or = 'Or',
    And = 'And',
    /**
     * Means !(A || B) == !A && !B
     */
    Nor = 'Nor',
    /**
     * Means !(A && B) == !A || !B
     */
    Nand = 'Nand',
}

interface RegistrationsFilterChoice {
    id: string;
    name: string;
    waitingList: boolean;
}

interface RegistrationsFilter {
    definitionId: string;
    choices: RegistrationsFilterChoice[];
    mode: RegistrationsFilterMode;
}

type Filter = NumberFilter | StringFilter | ChoicesFilter | DateFilter | FilterGroup | OldPropertyFilter | RegistrationsFilter;

enum FilterType {
    NumberFilter = 'NumberFilter',
    StringFilter = 'StringFilter',
    ChoicesFilter = 'ChoicesFilter',
    DateFilter = 'DateFilter',
    FilterGroup = 'FilterGroup',
    PropertyFilter = 'PropertyFilter',
    RegistrationsFilter = 'RegistrationsFilter',
}

// #endregion

function filterToStamhoofdFilter(filter: Filter): StamhoofdFilter {
    const type = getFilterType(filter);

    switch (type) {
        case FilterType.NumberFilter:
            return numberFilterToStamhoofdFilter(filter as NumberFilter);
        case FilterType.StringFilter:
            return stringFilterToStamhoofdFilter(filter as StringFilter);
        case FilterType.ChoicesFilter:
            return choicesFilterToStamhoofdFilter(filter as ChoicesFilter);
        case FilterType.DateFilter:
            return dateFilterToStamhoofdFilter(filter as DateFilter);
        case FilterType.FilterGroup:
            return filterGroupToStamhoofdFilter(filter as FilterGroup);
        case FilterType.PropertyFilter:
            throw new Error(`PropertyFilter not implemented: ${JSON.stringify(filter)}`);
        case FilterType.RegistrationsFilter:
            return registrationsFilterToStamhoofdFilter(filter as RegistrationsFilter);
    }
}

const filterDefinitionIDSQLFilterIdMap = new Map([
    ['member_age', 'age'],
    ['member_gender', 'gender'],
    ['member_birthDay', 'birthDay'],
    ['gender', 'gender'],
    // ['order_products', 'id'],
    // ['order_product_prices', 'id'],
    // ['order_checkoutMethod', 'id'],
]);

function getSQLFilterId(filter: Filter & { definitionId?: string }): string {
    const definitionId = filter.definitionId;
    if (!definitionId) {
        throw new Error('filter has no definitionId');
    }
    const result = filterDefinitionIDSQLFilterIdMap.get(definitionId);

    if (!result) {
        throw new Error('No sql filter id found for definitionId: ' + definitionId);
    }

    return result;
}

function numberFilterToStamhoofdFilter(filter: NumberFilter): StamhoofdFilter {
    if (filter.definitionId.startsWith('record_')) {
        throw new Error(`Number filter not supported: ${filter.definitionId}`);
    }

    const supported = new Set(['member_age']);

    if (!supported.has(filter.definitionId)) {
        throw new Error(`Number filter not supported: ${filter.definitionId}`);
    }

    const sqlFilterId = getSQLFilterId(filter);

    switch (filter.mode) {
        case NumberFilterMode.LessThan: {
            if (filter.end === undefined) {
                throw new Error('LessThan filter has no end');
            }

            return {
                [sqlFilterId]: {
                    $lte: filter.end,
                },
            };
        }
        case NumberFilterMode.GreaterThan: {
            if (filter.start === undefined) {
                throw new Error('GreaterThan filter has no start');
            }
            return {
                [sqlFilterId]: {
                    $gte: filter.start,
                },
            };
        }
        case NumberFilterMode.Between: {
            if (filter.start === undefined || filter.end === undefined) {
                throw new Error('Between filter has no start or end');
            }

            return {
                $and: [
                    { [sqlFilterId]: {
                        $gte: filter.start,
                    } },
                    { [sqlFilterId]: {
                        $lte: filter.end,
                    } },
                ],
            };
        }
        case NumberFilterMode.NotBetween: {
            if (filter.start === undefined || filter.end === undefined) {
                throw new Error('NotBetween filter has no start or end');
            }

            return {
                $or: [
                    { [sqlFilterId]: {
                        $lt: filter.start,
                    } },
                    { [sqlFilterId]: {
                        $gt: filter.end,
                    } },
                ],
            };
        }
        case NumberFilterMode.Equal: {
            if (filter.start === undefined) {
                throw new Error('Equal filter has no value: ' + JSON.stringify(filter));
            }
            return {
                [sqlFilterId]: {
                    $eq: filter.start,
                },
            };
        }
        case NumberFilterMode.NotEqual: {
            if (filter.start === undefined) {
                throw new Error('Not equal filter has no value');
            }
            return {
                [sqlFilterId]: {
                    $neq: filter.start,
                },
            };
        }
    }
}

function stringFilterToStamhoofdFilter(filter: StringFilter): StamhoofdFilter {
    if (filter.definitionId.startsWith('record_')) {
        const recordId = filter.definitionId.replace('record_', '');

        return {
            recordAnswers: {
                [recordId]: {
                    value: { $eq: filter.value },
                },
            },
        };
    }

    const supported = new Set(['member_name']);

    if (!supported.has(filter.definitionId)) {
        throw new Error(`String filter not supported: ${filter.definitionId}`);
    }

    const sqlFilterId = getSQLFilterId(filter);

    switch (filter.mode) {
        case StringFilterMode.Contains: {
            return {
                [sqlFilterId]: {
                    $contains: filter.value,
                },
            };
        }
        case StringFilterMode.NotContains: {
            return {
                $not: {
                    [sqlFilterId]: {
                        $contains: filter.value,
                    },
                },
            };
        }
        case StringFilterMode.Empty: {
            return {
                $or: [
                    {
                        [sqlFilterId]: {
                            $eq: '',
                        },
                    },
                    {
                        [sqlFilterId]: {
                            $eq: null,
                        },
                    },
                ],
            };
        }
        case StringFilterMode.NotEmpty: {
            return {
                $not: {
                    $or: [
                        {
                            [sqlFilterId]: {
                                $eq: '',
                            },
                        },
                        {
                            [sqlFilterId]: {
                                $eq: null,
                            },
                        },
                    ],
                },
            }; }
        case StringFilterMode.Equals: {
            return {
                [sqlFilterId]: {
                    $eq: filter.value,
                },
            };
        }
        case StringFilterMode.NotEquals: {
            return {
                $not: {
                    [sqlFilterId]: {
                        $eq: filter.value,
                    },
                },
            };
        }
    }
}

function choicesFilterToStamhoofdFilter(filter: ChoicesFilter): StamhoofdFilter {
    if (filter.definitionId.startsWith('record_')) {
        const choiceIds = filter.choiceIds;
        const isCheckbox = choiceIds.includes('checked') || choiceIds.includes('not_checked');

        const recordId = filter.definitionId.replace('record_', '');

        if (isCheckbox) {
            if (filter.mode !== ChoicesFilterMode.Or) {
                throw new Error(`Unsupported checkbox filter mode: ${filter.mode}`);
            }

            return {
                recordAnswers: {
                    [recordId]: {
                        selected: { $in: filter.choiceIds.map(choiceId => choiceId === 'checked') },
                    },
                },
            };
        }

        switch (filter.mode) {
            case ChoicesFilterMode.Or: {
                return {
                    recordAnswers: {
                        [recordId]: {
                            selectedChoices: {
                                id: {
                                    $in: choiceIds,
                                },
                            },
                        },
                    },
                };
            }
            case ChoicesFilterMode.And: {
                // todo: test
                return {
                    recordAnswers: {
                        [recordId]: {
                            $and: choiceIds.map((choiceId) => {
                                return {
                                    selectedChoices: {
                                        id: {
                                            $eq: choiceId,
                                        },
                                    },
                                };
                            }),

                        },
                    },
                };
            }
            default: {
                throw new Error(`Unsupported filter mode for record answers: ${filter.mode}`);
            }
        }
    }

    const supported = new Set(['member_gender', 'gender', 'member_missing_data', 'order_products', 'order_product_prices', 'order_checkoutMethod']);

    if (!supported.has(filter.definitionId)) {
        throw new Error(`Choices filter not supported: ${filter.definitionId}`);
    }

    if (filter.definitionId === 'member_missing_data') {
        const mappedChoiceIds = filter.choiceIds.map((choiceId) => {
            if (choiceId === 'emergencyContact') {
                return 'emergencyContacts';
            }
            return choiceId;
        });

        if (filter.mode === ChoicesFilterMode.Or) {
            return {
                missingData: {
                    $elemMatch: {
                        $in: mappedChoiceIds,
                    },
                },
            };
        }

        if (filter.mode === ChoicesFilterMode.Nor) {
            return {
                $not: {
                    missingData: {
                        $elemMatch: {
                            $in: mappedChoiceIds,
                        },
                    },
                },
            };
        }

        const filters: StamhoofdFilter[] = mappedChoiceIds.map((choiceId) => {
            return {
                missingData: {
                    $elemMatch: {
                        $in: [choiceId],
                    },
                },
            };
        });

        switch (filter.mode) {
            case ChoicesFilterMode.And: {
                return {
                    $and: filters,
                };
            }
            case ChoicesFilterMode.Nand: {
                return {
                    $not: {
                        $and: filters,
                    },
                };
            }
        }
    }

    if (filter.definitionId === 'order_products') {
        if (filter.mode === ChoicesFilterMode.Or) {
            return {
                items: {
                    $elemMatch: {
                        product: {
                            id: {
                                $in: filter.choiceIds,
                            },
                        },
                    },
                },
            };
        }

        if (filter.mode === ChoicesFilterMode.Nor) {
            return {
                $not: {
                    items: {
                        $elemMatch: {
                            product: {
                                id: {
                                    $in: filter.choiceIds,
                                },
                            },
                        },
                    },
                },
            };
        }

        const filters: StamhoofdFilter[] = filter.choiceIds.map((choiceId) => {
            return {
                items: {
                    $elemMatch: {
                        product: {
                            id: {
                                $in: [choiceId],
                            },
                        },
                    },
                },
            };
        });

        switch (filter.mode) {
            case ChoicesFilterMode.And: {
                return {
                    $and: filters,
                };
            }
            case ChoicesFilterMode.Nand: {
                return {
                    $not: {
                        $and: filters,
                    },
                };
            }
        }
    }

    if (filter.definitionId === 'order_product_prices') {
        const productPriceIds: Map<string, Set<string>> = new Map();

        for (const choiceId of filter.choiceIds) {
            const [productId, priceId] = choiceId.split(':');

            if (productPriceIds.has(productId)) {
                const set = productPriceIds.get(productId)!;
                set.add(priceId);
            }
            else {
                productPriceIds.set(productId, new Set([priceId]));
            }
        }

        const productFilters: StamhoofdFilter[] = [...productPriceIds.entries()].map(([productId, priceIds]) => {
            const priceIdsArray = [...priceIds.values()];

            if (filter.mode === ChoicesFilterMode.Or) {
                return {
                    items: {
                        $elemMatch: {
                            product: {
                                id: productId,
                            },
                            productPrice: {
                                id: {
                                    $in: priceIdsArray,
                                },
                            },
                        },
                    },
                } as StamhoofdFilter;
            }

            if (filter.mode === ChoicesFilterMode.Nor) {
                return {
                    $not: {
                        items: {
                            $elemMatch: {
                                product: {
                                    id: productId,
                                },
                                productPrice: {
                                    id: {
                                        $in: priceIdsArray,
                                    },
                                },
                            },
                        },
                    },
                };
            }

            const filters: StamhoofdFilter[] = priceIdsArray.map((priceId) => {
                return {
                    items: {
                        $elemMatch: {
                            product: {
                                id: productId,
                            },
                            productPrice: {
                                id: {
                                    $in: [priceId],
                                },
                            },
                        },
                    },
                };
            });

            switch (filter.mode) {
                case ChoicesFilterMode.And: {
                    return {
                        $and: filters,
                    };
                }
                case ChoicesFilterMode.Nand: {
                    return {
                        $not: {
                            $and: filters,
                        },
                    };
                }
            }
        });

        return groupFilterHelper(filter.mode, productFilters);
    }

    if (filter.definitionId === 'order_checkoutMethod') {
        if (filter.mode === ChoicesFilterMode.Or) {
            return {
                checkoutMethod: {
                    id: {
                        $in: filter.choiceIds,
                    },
                },
            };
        }

        if (filter.mode === ChoicesFilterMode.Nor) {
            return {
                $not: {
                    checkoutMethod: {
                        id: {
                            $in: filter.choiceIds,
                        },
                    },
                },
            };
        }

        const filters: StamhoofdFilter[] = filter.choiceIds.map((choiceId) => {
            return {
                checkoutMethod: {
                    id: {
                        $in: [choiceId],
                    },
                },
            };
        });

        switch (filter.mode) {
            case ChoicesFilterMode.And: {
                return {
                    $and: filters,
                };
            }
            case ChoicesFilterMode.Nand: {
                return {
                    $not: {
                        $and: filters,
                    },
                };
            }
        }
    }

    const sqlFilterId = getSQLFilterId(filter);

    switch (filter.mode) {
        case ChoicesFilterMode.Or: {
            return {
                [sqlFilterId]: {
                    $in: filter.choiceIds,
                },
            };
        }
        case ChoicesFilterMode.And: {
            throw new Error('And mode not supported for choices filter');
        }
        case ChoicesFilterMode.Nor: {
            return {
                $not: {
                    [sqlFilterId]: {
                        $in: filter.choiceIds,
                    },
                },
            };
        }
        case ChoicesFilterMode.Nand:
            throw new Error('Nand mode not supported for choices filter');
    }
}

function dateFilterToStamhoofdFilter(filter: DateFilter): StamhoofdFilter {
    if (filter.definitionId.startsWith('record_')) {
        throw new Error(`Date filter not supported: ${filter.definitionId}`);
    }

    const supported = new Set(['member_birthDay']);

    if (!supported.has(filter.definitionId)) {
        throw new Error(`Date filter not supported: ${filter.definitionId}`);
    }

    const sqlFilterId = getSQLFilterId(filter);

    function msToFilterValue(ms: number) {
        return { $: '$date', value: ms };
    }

    if (filter.minimumDate) {
        return {
            [sqlFilterId]: {
                $gte: filter.minimumDate,
            },
        };
    }

    switch (filter.mode) {
        case DateFilterMode.GreaterThan: {
            if (filter.minimumDate === undefined) {
                throw new Error('GreaterThan filter has no minimumDate');
            }
            return {
                [sqlFilterId]: {
                    $gte: msToFilterValue(filter.minimumDate),
                },
            };
        }
        case DateFilterMode.LessThan: {
            if (filter.maximumDate === undefined) {
                throw new Error('LessThan filter has no maximumDate');
            }
            return {
                [sqlFilterId]: {
                    $lte: msToFilterValue(filter.maximumDate),
                },
            };
        }
        case DateFilterMode.Between: {
            if (!filter.minimumDate || !filter.maximumDate) {
                throw new Error('Between filter has no minimumDate or maximumDate');
            }

            return {
                $and: [
                    {
                        [sqlFilterId]: {
                            $gte: msToFilterValue(filter.minimumDate),
                        },
                    },
                    {
                        [sqlFilterId]: {
                            $lte: msToFilterValue(filter.maximumDate),
                        },
                    },
                ],
            };
        }
        case DateFilterMode.NotBetween: {
            if (!filter.minimumDate || !filter.maximumDate) {
                throw new Error('NotBetween filter has no minimumDate or maximumDate');
            }

            return {
                $or: [
                    {
                        [sqlFilterId]: {
                            $lt: msToFilterValue(filter.minimumDate),
                        },
                    },
                    {
                        [sqlFilterId]: {
                            $gt: msToFilterValue(filter.maximumDate),
                        },
                    },
                ],
            };
        }
        case DateFilterMode.Equal: {
            if (filter.minimumDate === undefined) {
                throw new Error('Equal filter has no minimumDate');
            }

            return {
                [sqlFilterId]: {
                    $eq: msToFilterValue(filter.minimumDate),
                },
            };
        }
        case DateFilterMode.NotEqual: {
            if (filter.minimumDate === undefined) {
                throw new Error('NotEqual filter has no minimumDate');
            }

            return {
                $not: {
                    [sqlFilterId]: {
                        $eq: msToFilterValue(filter.minimumDate),
                    },
                },
            };
        }
    }
}

function getFilterType(filter: Filter): FilterType {
    if ('enabledWhen' in filter) {
        return FilterType.PropertyFilter;
    }

    if ('minimumDate' in filter || 'maximumDate' in filter) {
        return FilterType.DateFilter;
    }

    if ('choiceIds' in filter) {
        return FilterType.ChoicesFilter;
    }

    if ('filters' in filter) {
        return FilterType.FilterGroup;
    }

    if ('choices' in filter) {
        return FilterType.RegistrationsFilter;
    }

    if ('value' in filter) {
        return FilterType.StringFilter;
    }

    return FilterType.NumberFilter;
}

function groupFilterHelper(mode: 'Or' | 'And' | 'Nand' | 'Nor', filters: StamhoofdFilter[]): StamhoofdFilter {
    if (filters.length === 0) {
        console.error('filterGroupToStamhoofdFilter: no filters');
        return null;
    }

    if (filters.length === 1) {
        const singleFilter = filters[0];

        switch (mode) {
            case 'And':
                return singleFilter;
            case 'Or':
                return singleFilter;
            case 'Nand':
                return {
                    $not: singleFilter,
                };
            case 'Nor':
                return {
                    $not: singleFilter,
                };
        }
    }

    switch (mode) {
        case 'And':
            return {
                $and: filters,
            };
        case 'Or':
            return {
                $or: filters,
            };
        case 'Nand':
            return {
                $or: filters.flatMap(f => ({
                    $not: f,
                })),
            };
        case 'Nor':
            return {
                $and: filters.flatMap((f) => {
                    if (f !== null) {
                        // necessary to support 'order_product_prices' migration, else filter is not recognized in UI
                        if (f['$or'] && Array.isArray(f['$or'])) {
                            return f['$or'].map(f => ({ $not: f }));
                        }
                    }

                    return [{
                        $not: f,
                    }];
                }),
            };
    }
}

function filterGroupToStamhoofdFilter(filter: FilterGroup): StamhoofdFilter {
    const filters = filter.filters.map(f => filterToStamhoofdFilter(f));

    return groupFilterHelper(filter.mode, filters);
}

export function convertOldPropertyFilter(filter: OldPropertyFilter): PropertyFilter {
    let newEnabledWhen: StamhoofdFilter | null = null;
    let newRequiredWhen: StamhoofdFilter | null = {};

    if (filter.enabledWhen && filter.enabledWhen.data && (filter.enabledWhen.data as FilterGroup).filters.length !== 0) {
        newEnabledWhen = filterToStamhoofdFilter(filter.enabledWhen.data);
    }

    if (filter.requiredWhen === null) {
        newRequiredWhen = null;
    }
    else if (filter.requiredWhen.data && (filter.requiredWhen.data as FilterGroup).filters.length !== 0) {
        newRequiredWhen = filterToStamhoofdFilter(filter.requiredWhen.data);
    }

    return new PropertyFilter(newEnabledWhen, newRequiredWhen);
}

function registrationsFilterToStamhoofdFilter(filter: RegistrationsFilter): StamhoofdFilter {
    if (filter.definitionId !== 'registrations') {
        throw new Error(`Unknown filter definitionId for registrationsFilter: ${filter.definitionId}`);
    }

    // todo: ids should be converted in migration for groups?

    const mode = filter.mode;

    switch (mode) {
        case RegistrationsFilterMode.Or: {
            return {
                registrations: {
                    $elemMatch: {
                        $or: filter.choices.map((c) => {
                            return {
                                $groupId: {
                                    $eq: c.id,
                                },
                            };
                        }),
                    },
                },
            };
        }
        case RegistrationsFilterMode.And: {
            return {
                registrations: {
                    $elemMatch: {
                        $and: filter.choices.map((c) => {
                            return {
                                $groupId: {
                                    $eq: c.id,
                                },
                            };
                        }),
                    },
                },
            };
        }
        case RegistrationsFilterMode.Nor: {
            return {
                registrations: {
                    $not: {
                        $elemMatch: {
                            $or: filter.choices.map((c) => {
                                return {
                                    $groupId: {
                                        $eq: c.id,
                                    },
                                };
                            }),
                        },
                    },
                },
            };
        }
        case RegistrationsFilterMode.Nand: {
            return {
                registrations: {
                    $not: {
                        $elemMatch: {
                            $and: filter.choices.map((c) => {
                                return {
                                    $groupId: {
                                        $eq: c.id,
                                    },
                                };
                            }),
                        },
                    },
                },
            };
        }
    }
}
