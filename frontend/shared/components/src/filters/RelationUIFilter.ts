import type { SortList, StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';

import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { Formatter } from '../../../../../shared/utility/dist/Formatter';
import type { InfiniteObjectFetcher, ObjectFetcher } from '../tables';
import RelationUIFilterView from './RelationUIFilterView.vue';
import type { UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper } from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';

export type RelationFilterOption<T extends string | number | Date | null | boolean> = {
    name: string;
    value: T;
}

export class RelationUIFilter<T extends string | number | Date | null | boolean> extends UIFilter<RelationFilterBuilder<T>> {
    readonly relationFetcher: RelationFetcher<any, T>;
    name: string = '';
    values: RelationFilterOption<T>[] = [];

    constructor(data: Partial<RelationUIFilter<T>>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        const items = this.values.map(value => {
            return {
                $: '$rel',
                ...value
            }
        });

        return {
            [this.builder.key]: {
                $in: items
            }
        }
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(RelationUIFilterView, {
            filter: this,
        });
    }

    get valuesToString() {
        return Formatter.joinLast(this.values.map(v => v.name), ', ', ` ${$t('of')} ` );
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

    constructor(data: { key: string; name: string; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; allowCreation?: boolean, relationFetcher: RelationFetcher<any, T> }) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.wrapper = data.wrapper;
        this.name = data.name;
        this.allowCreation = data.allowCreation;
        this.relationFetcher = data.relationFetcher;
    }

    create(options?: { isInverted?: boolean; }): RelationUIFilter<T> {
        return new RelationUIFilter({
            builder: this,
            relationFetcher: this.relationFetcher
        }, options);
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const match = unwrapFilterForBuilder(this, filter);
        if (!match.match || match.markerValue === undefined) {
            return null;
        }

        const response = match.markerValue;
        if (!response || typeof response !== 'object') {
            return null;
        }

        const responseWithKey: StamhoofdFilter & Partial<{[key: string]: any}> = response;
        if (!responseWithKey[this.key]) {
            return null;
        }

        const value = responseWithKey[this.key];
        let array: any[] | undefined = undefined;

        if (Array.isArray(value)) {
            array = value;
        } else if (typeof value === 'object') {
            const object: { $in?: any[], $or?: any[] } = value;
            if (Object.hasOwn(object, '$in')) {
                array = object['$in'];
            } else if (Object.hasOwn(object, '$or')) {
                array = object['$or'];
            }
        }

        if (!array || array.length === 0) {
            return null;
        }

        const values: RelationFilterOption<T>[] = [];

        for (const item of array) {
            if (typeof item !== 'object') {
                return null;
            }
            const object: Partial<{ $: string, name: string, value: T }> = item;
            if (object.$ !== '$rel' || object.name === undefined || object.value === undefined) {
                return null;
            }

            values.push({
                name: object.name,
                value: object.value
            });
        }

        return new RelationUIFilter({
            builder: this,
            relationFetcher: this.relationFetcher,
            values,
        });
    }
}

export class RelationFetcher<OBJECT extends {id: string}, T extends string | number | Date | null | boolean> {
    readonly fetcher: ObjectFetcher<OBJECT>;
    
    private readonly getName: (object: OBJECT) => string;
    private readonly getValue: (object: OBJECT) => T;

    private readonly limit?: number;
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
        this.limit = limit;
        this.sort = sort;
    }

    configureInfiniteObjectFetcher(infiniteObjectFetcher: InfiniteObjectFetcher<OBJECT>) {
        if (this.sort) {
            infiniteObjectFetcher.sort = this.sort;
        }

        if (this.limit) {
            infiniteObjectFetcher.limit = this.limit;
        }
        
    }

    resultsToOptions(results: OBJECT[]): RelationFilterOption<T>[] {
        return results.map(object => ({
            name: this.getName(object),
            value: this.getValue(object)
        }));
    }
}
