import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';
import { unwrapFilterByPath } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { NumberFilterFormat } from './NumberFilterFormat.ts';

import type { UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper } from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';
import { UINumberFilterMode } from './UINumberFilterMode.ts';

export class NumberUIFilter extends UIFilter<NumberFilterBuilder> {
    value = 0;
    mode: UINumberFilterMode = UINumberFilterMode.Equals;

    constructor(data: Partial<NumberUIFilter>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        switch (this.mode) {
            case UINumberFilterMode.Equals: return {
                [this.builder.key]: {
                    $eq: this.value,
                },
            };

            case UINumberFilterMode.NotEquals: return {
                $not: {
                    [this.builder.key]: {
                        $eq: this.value,
                    },
                },
            };

            case UINumberFilterMode.GreaterThan: return {
                [this.builder.key]: {
                    $gt: this.value,
                },
            };

            case UINumberFilterMode.GreaterThanOrEqual: return {
                [this.builder.key]: {
                    $gte: this.value,
                },
            };

            case UINumberFilterMode.LessThan: return {
                [this.builder.key]: {
                    $lt: this.value,
                },
            };

            case UINumberFilterMode.LessThanOrEqual: return {
                [this.builder.key]: {
                    $lte: this.value,
                },
            };
        }
    }

    getComponent(): ComponentWithProperties {
        return AsyncComponent(() => import('./NumberUIFilterView.vue'), {
            filter: this,
        });
    }

    get combinationWord(): string {
        switch (this.mode) {
            case UINumberFilterMode.GreaterThan: return $t(`%bE`);
            case UINumberFilterMode.GreaterThanOrEqual: return $t(`%1ad`);
            case UINumberFilterMode.LessThan: return $t(`%bF`);
            case UINumberFilterMode.LessThanOrEqual: return $t(`%1cL`);
            case UINumberFilterMode.Equals: return $t(`%bG`);
            case UINumberFilterMode.NotEquals: return $t(`%bH`);
        }
    }

    get styledDescription() {
        return [
            {
                text: this.builder.name,
                style: '',
            },
            {
                text: ' ' + this.combinationWord + ' ',
                style: 'gray',
            }, {
                text: this.valueToText,
                style: '',
            },
        ];
    }

    private get valueToText() {
        switch (this.builder.type) {
            case NumberFilterFormat.Number: return this.value.toFixed(this.builder.floatingPoint ? 2 : 0);
            case NumberFilterFormat.Currency: return Formatter.price(this.value);
            case NumberFilterFormat.TimeMinutes: {
                const dateZero = new Date(0);
                dateZero.setMinutes(this.value);
                return Formatter.time(dateZero, 'utc');
            };
        }
    }
}

export class NumberFilterBuilder implements UIFilterBuilder<NumberUIFilter> {
    key = '';
    name = '';
    description = '';
    wrapFilter?: UIFilterWrapper | null;
    unwrapFilter?: UIFilterUnwrapper | null;
    wrapper?: WrapperFilter;
    additionalUnwrappers?: WrapperFilter[];

    floatingPoint = false;
    type = NumberFilterFormat.Number;

    constructor(data: { key: string; name: string; description?: string; type?: NumberFilterFormat; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; additionalUnwrappers?: WrapperFilter[] }) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.name = data.name;
        this.description = data.description ?? '';
        this.wrapper = data.wrapper;
        this.additionalUnwrappers = data.additionalUnwrappers;
        if (data.type !== undefined) {
            this.type = data.type;
        }
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const { markerValue: unwrapped, isInverted } = unwrapFilterForBuilder(this, filter);
        if (unwrapped === null || unwrapped === undefined) {
            return null;
        }
        if (!(typeof unwrapped === 'object')) {
            return null;
        }

        const equals = unwrapFilterByPath(unwrapped, [this.key, '$eq']) ?? unwrapFilterByPath(unwrapped, [this.key]); ;

        if (typeof equals === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: equals,
                mode: UINumberFilterMode.Equals,
            }, { isInverted });
        }

        const notEquals = unwrapFilterByPath(unwrapped, ['$not', this.key, '$eq']) ?? unwrapFilterByPath(unwrapped, [this.key, '$neq']);

        if (typeof notEquals === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: notEquals,
                mode: UINumberFilterMode.NotEquals,
            }, { isInverted });
        }

        const lessThan = unwrapFilterByPath(unwrapped, [this.key, '$lt']);

        if (typeof lessThan === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: lessThan,
                mode: UINumberFilterMode.LessThan,
            }, { isInverted });
        }

        const lessThanOrEqual = unwrapFilterByPath(unwrapped, [this.key, '$lte']);

        if (typeof lessThanOrEqual === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: lessThanOrEqual,
                mode: UINumberFilterMode.LessThanOrEqual,
            }, { isInverted });
        }

        const greaterThan = unwrapFilterByPath(unwrapped, [this.key, '$gt']);

        if (typeof greaterThan === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: greaterThan,
                mode: UINumberFilterMode.GreaterThan,
            }, { isInverted });
        }

        const greaterThanOrEqual = unwrapFilterByPath(unwrapped, [this.key, '$gte']);

        if (typeof greaterThanOrEqual === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: greaterThanOrEqual,
                mode: UINumberFilterMode.GreaterThanOrEqual,
            }, { isInverted });
        }

        return null;
    }

    create(options: { isInverted?: boolean } = {}): NumberUIFilter {
        return new NumberUIFilter({
            builder: this,
            value: 0,
        }, options);
    }
}
