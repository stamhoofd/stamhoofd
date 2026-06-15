import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { InfiniteObjectFetcher } from '#tables/classes/InfiniteObjectFetcher.ts';
import type { ObjectFetcher } from '#tables/classes/ObjectFetcher.ts';
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { SortList, StamhoofdFilter, StamhoofdMagicRelationFilter, WrapperFilter } from '@stamhoofd/structures';
import { isMagicRelationFilter, unwrapFilterByPath } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import type { UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper } from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';

export type RelationFilterOption<T extends string | number | Date | null | boolean> = {
    name: string;
    description?: string;
    value: T;
};

export class RelationUIFilter<T extends string | number | Date | null | boolean> extends UIFilter<RelationFilterBuilder<T>> {
    readonly relationFetcher: RelationFetcher<any, T>;
    name: string = '';
    // The optional type of the magic relation filter.
    type?: string;
    values: RelationFilterOption<T>[] = [];
    defaultOptions: RelationFilterOption<T>[] = [];

    constructor(data: Partial<RelationUIFilter<T>>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    flatten() {
        if (this.values.length === 0) {
            return null;
        }

        return super.flatten();
    }

    doBuild(): StamhoofdFilter {
        const items: StamhoofdMagicRelationFilter[] = this.values.map((value) => {
            const item: StamhoofdMagicRelationFilter = {
                $: '$rel',
                ...value,
            };

            return item;
        });

        if (this.type && items.length > 0) {
            items[0].type = this.type;
        }

        if (items.length === 1) {
            return {
                [this.builder.key]: items[0],
            };
        }

        return {
            [this.builder.key]: {
                $in: items,
            },
        };
    }

    getComponent(): ComponentWithProperties {
        return AsyncComponent(() => import('./RelationUIFilterView.vue'), {
            filter: this,
        });
    }

    get valuesToString() {
        return Formatter.joinLastLimited(this.values.map(v => v.name), {
            separator: ', ',
            lastSeparator: ` ${$t('of')} `,
            maxLength: 250,
        });
    }

    get styledDescription() {
        return [
            {
                text: this.builder.name,
                style: '',
            },
            {
                text: ` ${$t('is')} `,
                style: 'gray',
            },
            {
                text: this.valuesToString,
                style: '',
            },
        ];
    }
}

export class RelationFilterBuilder<T extends string | number | Date | null | boolean> implements UIFilterBuilder<RelationUIFilter<T>> {
    readonly key: string;
    readonly name: string;
    readonly wrapFilter?: UIFilterWrapper | null;
    readonly unwrapFilter?: UIFilterUnwrapper | null;
    readonly wrapper?: WrapperFilter;
    readonly allowCreation?: boolean;
    readonly relationFetcher: RelationFetcher<any, T>;
    // The optional type of the magic relation filter.
    readonly type?: string;

    /**
     * Options that should always be shown. For example to filter on objects that have no relation (where the value is null).
     */
    private readonly defaultOptions: RelationFilterOption<T>[];

    constructor(data: { key: string; name: string; type?: string; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; allowCreation?: boolean; relationFetcher: RelationFetcher<any, T>; defaultOptions?: RelationFilterOption<T>[] }) {
        this.key = data.key;
        this.type = data.type;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.wrapper = data.wrapper;
        this.name = data.name;
        this.allowCreation = data.allowCreation;
        this.relationFetcher = data.relationFetcher;
        this.defaultOptions = data.defaultOptions || [];
    }

    create(options?: { isInverted?: boolean }): RelationUIFilter<T> {
        return new RelationUIFilter({
            builder: this,
            relationFetcher: this.relationFetcher,
            type: this.type,
            defaultOptions: this.defaultOptions,
        }, options);
    }

    private getOptionsFromFilter(filter: StamhoofdFilter): null | RelationFilterOption<T>[] {
        const array = Array.isArray(filter) ? filter : [filter];
        if (!array || array.length === 0) {
            return null;
        }

        const values: RelationFilterOption<T>[] = [];

        let type: string | null = null;

        for (const item of array) {
            if (!isMagicRelationFilter(item)) {
                return null;
            }

            if (type === null && item.type) {
                type = item.type;
            }

            values.push({
                name: item.name,
                value: item.value as T,
            });
        }

        if (type !== null || this.type) {
            if (type !== this.type) {
                return null;
            }
        }

        return values;
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const { markerValue: unwrapped, isInverted } = unwrapFilterForBuilder(this, filter);
        if (!unwrapped || typeof unwrapped !== 'object') {
            return null;
        }

        for (const subKey of ['$in', '$or']) {
            const filter = unwrapFilterByPath(unwrapped, [this.key, subKey]);
            if (filter === undefined) {
                continue;
            }
            const options = this.getOptionsFromFilter(filter);
            if (options) {
                return new RelationUIFilter({
                    builder: this,
                    relationFetcher: this.relationFetcher,
                    values: options,
                    type: this.type,
                    defaultOptions: this.defaultOptions,
                }, { isInverted });
            }
        }

        return null;
    }
}

export type RelationFetcherSubFilterOption = { filter: StamhoofdFilter; name: string };

export class RelationFetcherSubFilter {
    private readonly getOptions: () => Promise<RelationFetcherSubFilterOption[]> | RelationFetcherSubFilterOption[];
    private options: RelationFetcherSubFilterOption[] | null = null;
    readonly isRequired: boolean;
    readonly findDefaultOption?: (option: RelationFetcherSubFilterOption) => boolean;

    constructor({ getOptions, isRequired, findDefaultOption }: {
        getOptions: () => Promise<RelationFetcherSubFilterOption[]> | RelationFetcherSubFilterOption[];
        isRequired?: boolean;
        findDefaultOption?: (option: RelationFetcherSubFilterOption) => boolean; }) {
        this.getOptions = getOptions;
        this.findDefaultOption = findDefaultOption;
        this.isRequired = isRequired ?? false;
    }

    get shouldHaveDefaultFilter(): boolean {
        return this.isRequired || this.findDefaultOption !== undefined;
    }

    async loadOptions(): Promise<RelationFetcherSubFilterOption[]> {
        if (this.options !== null) {
            return this.options;
        }

        this.options = await this.getOptions();
        return this.options;
    }

    getDefaultOption(options: RelationFetcherSubFilterOption[]): RelationFetcherSubFilterOption {
        if (this.findDefaultOption) {
            return options.find(this.findDefaultOption) ?? RelationFetcherSubFilter.emptyOption;
        }

        if (this.isRequired) {
            return options[0] ?? RelationFetcherSubFilter.emptyOption;
        }

        return RelationFetcherSubFilter.emptyOption;
    }

    async getAllOptions() {
        const options = await this.loadOptions();

        if (this.isRequired) {
            return options;
        }

        return [RelationFetcherSubFilter.emptyOption, ...options];
    }

    static get emptyOption(): RelationFetcherSubFilterOption {
        return {
            name: $t('Geen filter'),
            filter: null,
        };
    }
}

export class RelationFetcher<OBJECT extends { id: string }, T extends string | number | Date | null | boolean> {
    readonly fetcher: ObjectFetcher<OBJECT>;

    private readonly getName: (object: OBJECT) => string;
    private readonly getDescription?: (object: OBJECT) => string;
    private readonly getValue: (object: OBJECT) => T;

    readonly filter?: StamhoofdFilter;
    private readonly limit?: number;
    private readonly sort?: SortList;

    readonly subFilter?: RelationFetcherSubFilter;

    constructor({ fetcher, getName, getDescription, getValue, filter, limit, sort, subFilter }: {
        fetcher: ObjectFetcher<OBJECT>;
        getName: (object: OBJECT) => string;
        getValue: (object: OBJECT) => T;
        getDescription?: (object: OBJECT) => string;
        filter?: StamhoofdFilter;
        limit?: number;
        sort?: SortList;
        subFilter?: RelationFetcherSubFilter;
    }) {
        this.fetcher = fetcher;
        this.getName = getName;
        this.getDescription = getDescription;
        this.getValue = getValue;
        this.filter = filter;
        this.limit = limit;
        this.sort = sort;
        this.subFilter = subFilter;
    }

    configureInfiniteObjectFetcher(infiniteObjectFetcher: InfiniteObjectFetcher<OBJECT>) {
        if (this.filter) {
            infiniteObjectFetcher.baseFilter = this.filter;
        }

        if (this.sort) {
            infiniteObjectFetcher.sort = this.sort;
        }

        if (this.limit) {
            infiniteObjectFetcher.limit = this.limit;
        }
    }

    resultsToOptions(results: OBJECT[]): RelationFilterOption<T>[] {
        const getDescription = this.getDescription;

        if (getDescription) {
            return results.map(object => ({
                name: this.getName(object),
                description: getDescription(object),
                value: this.getValue(object),
            }));
        }

        return results.map(object => ({
            name: this.getName(object),
            value: this.getValue(object),
        }));
    }
}
