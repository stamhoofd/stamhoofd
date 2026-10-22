import type { InfiniteObjectFetcher } from '#tables/classes/InfiniteObjectFetcher.ts';
import type { ObjectFetcher } from '#tables/classes/ObjectFetcher.ts';
import type { SortList, StamhoofdFilter } from '@stamhoofd/structures';
import type { RelationFilterOption, RelationFetcherSubFilterOption, RelationFetcherContract, RelationFetcherSubFilterContract } from './RelationFilterTypes';

export type { RelationFetcherSubFilterOption } from './RelationFilterTypes';

export class RelationFetcherSubFilter implements RelationFetcherSubFilterContract {
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
        return { name: $t('%1cm'), filter: null };
    }
}

export class RelationFetcher<OBJECT extends { id: string }, T extends string | number | Date | null | boolean> implements RelationFetcherContract<OBJECT, T> {
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
            return results.map(object => ({ name: this.getName(object), description: getDescription(object), value: this.getValue(object) }));
        }
        return results.map(object => ({ name: this.getName(object), value: this.getValue(object) }));
    }
}
