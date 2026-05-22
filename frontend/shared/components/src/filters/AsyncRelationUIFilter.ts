import type { StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';

import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { Formatter } from '../../../../../shared/utility/dist/Formatter';
import AsyncRelationUIFilterView from './AsyncRelationUIFilterView.vue';
import type { UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper } from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';

export enum AsyncRelationUIFilterMode {
    And = 'And',
    Or = 'Or',
}

export type AsyncRelationFilterOption<T extends string | number | Date | null | boolean> = {
    name: string;
    value: T;
}

export type AsyncRelationUIFilterConfig = {
    mode?: AsyncRelationUIFilterMode,
    /**
     * Debounce in ms for loading options when the search query changed.
     */
    searchDebounce?: number
}

export class AsyncRelationUIFilter<T extends string | number | Date | null | boolean> extends UIFilter<AsyncRelationFilterBuilder<T>> {
    readonly loadOptions: (searchFilter: string) => Promise<AsyncRelationFilterOption<T>[]>
    name: string = '';
    values: AsyncRelationFilterOption<T>[] = [];
    config: AsyncRelationUIFilterConfig;

    constructor(data: Partial<AsyncRelationUIFilter<T>>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    get mode() {
        return this.config.mode ?? AsyncRelationUIFilterMode.Or;
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

        if (this.mode === AsyncRelationUIFilterMode.And) {
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
        return new ComponentWithProperties(AsyncRelationUIFilterView, {
            filter: this,
        });
    }

    get valuesToString() {
        const joinWord = this.mode === AsyncRelationUIFilterMode.Or ? $t('of') : $t('en');
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

export class AsyncRelationFilterBuilder<T extends string | number | Date | null | boolean> implements UIFilterBuilder<AsyncRelationUIFilter<T>> {
    readonly key: string;
    readonly name: string;
    readonly wrapFilter?: UIFilterWrapper | null;
    readonly unwrapFilter?: UIFilterUnwrapper | null;
    readonly wrapper?: WrapperFilter;
    readonly allowCreation?: boolean;
    readonly loadOptions: (searchFilter: string) => Promise<AsyncRelationFilterOption<T>[]>
    readonly config: AsyncRelationUIFilterConfig;

    constructor(data: { key: string; name: string; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; allowCreation?: boolean, loadOptions: (searchFilter: string) => Promise<AsyncRelationFilterOption<T>[]>, config?: AsyncRelationUIFilterConfig }) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.wrapper = data.wrapper;
        this.name = data.name;
        this.allowCreation = data.allowCreation;
        this.loadOptions = data.loadOptions;
        this.config = data.config ?? {};
    }

    create(options?: { isInverted?: boolean; }): AsyncRelationUIFilter<T> {
        return new AsyncRelationUIFilter({
            builder: this,
            loadOptions: this.loadOptions,
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
