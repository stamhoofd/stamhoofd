import type { SortList, StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest } from '@stamhoofd/structures';

import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { Formatter } from '../../../../../shared/utility/dist/Formatter';
import type { ObjectFetcher } from '../tables';
import RelationUIFilterView from './RelationUIFilterView.vue';
import type { UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper } from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';

export enum RelationUIFilterMode {
    And = 'And',
    Or = 'Or',
}

export type RelationFilterOption<T extends string | number | Date | null | boolean> = {
    name: string;
    value: T;
}

export type RelationUIFilterConfig = {
    mode?: RelationUIFilterMode,
    /**
     * Debounce in ms for loading options when the search query changed.
     */
    searchDebounce?: number
}

export class RelationUIFilter<T extends string | number | Date | null | boolean> extends UIFilter<RelationFilterBuilder<T>> {
    readonly relationFetcher: RelationFetcher<any, T>;
    name: string = '';
    values: RelationFilterOption<T>[] = [];
    config: RelationUIFilterConfig;

    constructor(data: Partial<RelationUIFilter<T>>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    get mode() {
        return this.config.mode ?? RelationUIFilterMode.Or;
    }

    /**
     * Debounce in ms for loading options when the search query changed.
     */
    get searchDebounce() {
        return this.config.searchDebounce === undefined ? 500 : this.config.searchDebounce;
    }

    doBuild(): StamhoofdFilter {
        const items = this.values.map(value => {
            return {
                $: '$rel',
                ...value
            }
        });

        if (this.mode === RelationUIFilterMode.And) {
            return {
                [this.builder.key]: items
            }
        }

        return {
            [this.builder.key]: {
                $or: items
            }
        }
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(RelationUIFilterView, {
            filter: this,
        });
    }

    get valuesToString() {
        const joinWord = this.mode === RelationUIFilterMode.Or ? $t('of') : $t('en');
        return Formatter.joinLast(this.values.map(v => v.name), ', ', ` ${joinWord} ` );
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
    readonly config: RelationUIFilterConfig;

    constructor(data: { key: string; name: string; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; allowCreation?: boolean, relationFetcher: RelationFetcher<any, T>, config?: RelationUIFilterConfig }) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.wrapper = data.wrapper;
        this.name = data.name;
        this.allowCreation = data.allowCreation;
        this.relationFetcher = data.relationFetcher;
        this.config = data.config ?? {};
    }

    create(options?: { isInverted?: boolean; }): RelationUIFilter<T> {
        return new RelationUIFilter({
            builder: this,
            relationFetcher: this.relationFetcher,
            config: this.config
        }, options);
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const { markerValue: unwrapped, isInverted } = unwrapFilterForBuilder(this, filter);
        
        if (unwrapped === null || unwrapped === undefined) {
            return null;
        }

        if (!(typeof unwrapped === 'object')) {
            return null;
        }

        // todo

        return null;
    }
}

export class RelationFetcher<OBJECT, T extends string | number | Date | null | boolean> {
    private readonly fetcher: ObjectFetcher<OBJECT>;
    
    private readonly getName: (object: OBJECT) => string;
    private readonly getValue: (object: OBJECT) => T;

    private readonly limit: number;
    private readonly sort?: SortList;

    constructor({fetcher, getName, getValue, limit, sort}: {
        fetcher: ObjectFetcher<OBJECT>,
        getName: (object: OBJECT) => string,
        getValue: (object: OBJECT) => T,
        limit?: number,
        sort?: SortList
    }) {
        this.fetcher = fetcher;
        this.getName = getName;
        this.getValue = getValue;
        this.limit = limit ?? 20;
        this.sort = sort;
    }

    async fetch(search: string): Promise<RelationFilterOption<T>[]> {
        const request = new LimitedFilteredRequest({
            search,
            limit: this.limit,
            sort: this.sort
        });

        const objects = (await this.fetcher.fetch(request)).results;

        return objects.map(object => ({
            name: this.getName(object),
            value: this.getValue(object)
        }));
    }
}
