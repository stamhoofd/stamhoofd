import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';
import { unwrapFilterByPath } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import NumberUIFilterView from './NumberUIFilterView.vue';
import type { UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper} from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';

export enum UINumberFilterMode {
    GreaterThan = 'GreaterThan',
    LessThan = 'LessThan',
    Equals = 'Equals',
    NotEquals = 'NotEquals',
}

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

            case UINumberFilterMode.LessThan: return {
                [this.builder.key]: {
                    $lt: this.value,
                },
            };
        }
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(NumberUIFilterView, {
            filter: this,
        });
    }

    get combinationWord(): string {
        switch (this.mode) {
            case UINumberFilterMode.GreaterThan: return $t(`%bE`);
            case UINumberFilterMode.LessThan: return $t(`%bF`);
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

export enum NumberFilterFormat {
    Number,
    Currency,
    TimeMinutes,
}

export class NumberFilterBuilder implements UIFilterBuilder<NumberUIFilter> {
    key = '';
    name = '';
    wrapFilter?: UIFilterWrapper | null;
    unwrapFilter?: UIFilterUnwrapper | null;
    wrapper?: WrapperFilter;
    additionalUnwrappers?: WrapperFilter[];

    floatingPoint = false;
    type = NumberFilterFormat.Number;

    constructor(data: { key: string; name: string; type?: NumberFilterFormat; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; additionalUnwrappers?: WrapperFilter[] }) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.name = data.name;
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

        const equals = unwrapFilterByPath(unwrapped, [this.key, '$eq']);

        if (typeof equals === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: equals,
                mode: UINumberFilterMode.Equals,
            }, { isInverted });
        }

        const notEquals = unwrapFilterByPath(unwrapped, ['$not', this.key, '$eq']);

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

        const greaterThan = unwrapFilterByPath(unwrapped, [this.key, '$gt']);

        if (typeof greaterThan === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: greaterThan,
                mode: UINumberFilterMode.GreaterThan,
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
