import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { ComponentWithProperties } from '@browser/navigation';
import type { StamhoofdFilter, StamhoofdMagicRelationFilter, WrapperFilter } from '@stamhoofd/structures';
import { isMagicRelationFilter, unwrapFilterByPath } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { RelationFetcher } from './RelationFetcher';
import type { RelationFilterOption, RelationUIFilterViewProperties } from './RelationFilterTypes';
export { RelationFetcher, RelationFetcherSubFilter } from './RelationFetcher';
export type { RelationFetcherSubFilterOption } from './RelationFetcher';
export type { RelationFilterOption, RelationUIFilterViewProperties } from './RelationFilterTypes';

import type { UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper } from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';

type RelationUIFilterViewOptions<T extends string | number | Date | null | boolean> = Pick<RelationUIFilterViewProperties<T>, 'searchEnabled'>;

export class RelationUIFilter<T extends string | number | Date | null | boolean> extends UIFilter<RelationFilterBuilder<T>> {
    readonly relationFetcher: RelationFetcher<any, T>;
    readonly viewProperties: RelationUIFilterViewOptions<T> = {};
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
            ...this.viewProperties,
            filter: this,
        });
    }

    get valuesToString() {
        return Formatter.joinLastLimited(this.values.map(v => v.name), {
            separator: ', ',
            lastSeparator: ` ${$t('%GT')} `,
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
                text: '',
                style: '',
                choices: [
                    {
                        id: 'is',
                        text: $t('%1q'),
                        action: () => {
                            this.isInverted = false;
                        },
                        isSelected: () => !this.isInverted,
                    },
                    {
                        id: 'is not',
                        text: $t('%bT'),
                        action: () => {
                            this.isInverted = true;
                        },
                        isSelected: () => this.isInverted,
                    },
                ],
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
    private readonly viewProperties: RelationUIFilterViewOptions<T>;
    // The optional type of the magic relation filter.
    readonly type?: string;

    /**
     * Options that should always be shown. For example to filter on objects that have no relation (where the value is null).
     */
    private readonly defaultOptions: RelationFilterOption<T>[];

    constructor(data: { key: string; name: string; type?: string; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; allowCreation?: boolean; relationFetcher: RelationFetcher<any, T>; defaultOptions?: RelationFilterOption<T>[]; viewProperties?: RelationUIFilterViewOptions<T> }) {
        this.key = data.key;
        this.type = data.type;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.wrapper = data.wrapper;
        this.name = data.name;
        this.allowCreation = data.allowCreation;
        this.relationFetcher = data.relationFetcher;
        this.defaultOptions = data.defaultOptions || [];
        this.viewProperties = data.viewProperties ?? {};
    }

    create(options?: { isInverted?: boolean }): RelationUIFilter<T> {
        return new RelationUIFilter({
            builder: this,
            relationFetcher: this.relationFetcher,
            type: this.type,
            defaultOptions: this.defaultOptions,
            viewProperties: this.viewProperties,
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
        const { markerValue: unwrapped, isInverted } = unwrapFilterForBuilder(this, filter, true);
        if (!unwrapped || typeof unwrapped !== 'object') {
            return null;
        }

        {
            const filter = unwrapFilterByPath(unwrapped, [this.key, '$in']);
            if (filter) {
                const options = this.getOptionsFromFilter(filter);
                if (options) {
                    return new RelationUIFilter({
                        builder: this,
                        relationFetcher: this.relationFetcher,
                        values: options,
                        type: this.type,
                        defaultOptions: this.defaultOptions,
                        viewProperties: this.viewProperties,
                    }, { isInverted });
                }
            }
        }

        {
            const filter = unwrapFilterByPath(unwrapped, [this.key]);
            if (filter) {
                const options = this.getOptionsFromFilter(filter);
                if (options) {
                    return new RelationUIFilter({
                        builder: this,
                        relationFetcher: this.relationFetcher,
                        values: options,
                        type: this.type,
                        defaultOptions: this.defaultOptions,
                        viewProperties: this.viewProperties,
                    }, { isInverted });
                }
            }
        }

        return null;
    }
}
