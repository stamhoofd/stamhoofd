import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter } from "@stamhoofd/structures";

import { Formatter } from "@stamhoofd/utility";
import NumberUIFilterView from "./NumberUIFilterView.vue";
import { UIFilter, UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper, unwrapFilterByPath, unwrapFilterForBuilder, WrapperFilter } from "./UIFilter";

export enum UINumberFilterMode {
    GreaterThan = "GreaterThan",
    LessThan = "LessThan",
    Equals = "Equals",
    NotEquals = "NotEquals"
}

export class NumberUIFilter extends UIFilter {
    builder!: NumberFilterBuilder
    value = 0
    mode: UINumberFilterMode = UINumberFilterMode.Equals

    constructor(data: Partial<NumberUIFilter>, options: {isInverted?: boolean} = {}) {
        super(data, options)
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        switch (this.mode) {
            case UINumberFilterMode.Equals: return {
                [this.builder.key]: {
                    "$eq": this.value
                }
            };

            case UINumberFilterMode.NotEquals: return {
                $not: {
                    [this.builder.key]: {
                        "$eq": this.value
                    }
                }
            };

            case UINumberFilterMode.GreaterThan: return {
                [this.builder.key]: {
                    "$gt": this.value
                }
            };

            case UINumberFilterMode.LessThan: return {
                [this.builder.key]: {
                    "$lt": this.value
                }
            };
        }
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(NumberUIFilterView, {
            filter: this
        })
    }

    get combinationWord(): string {
        switch (this.mode) {
            case UINumberFilterMode.GreaterThan: return 'is groter dan';
            case UINumberFilterMode.LessThan: return 'is kleiner dan';
            case UINumberFilterMode.Equals: return 'is gelijk aan';
            case UINumberFilterMode.NotEquals: return 'is niet gelijk aan';
        }
    }

    get styledDescription() {
        return [
            {
                text: this.builder.name,
                style: ''
            },
            {
                text: ' '+ this.combinationWord +' ',
                style: 'gray'
            }, {
                text: this.builder.currency ? Formatter.price(this.value) : this.value.toFixed(this.builder.floatingPoint ? 2 : 0),
                style: ''
            }
        ]
    }
}

export class NumberFilterBuilder implements UIFilterBuilder<NumberUIFilter> {
    key = ""
    name = ""
    wrapFilter?: UIFilterWrapper | null
    unwrapFilter?: UIFilterUnwrapper | null;
    wrapper?: WrapperFilter;

    floatingPoint = false
    currency = false

    constructor(data: {key: string, name: string, wrapFilter?: UIFilterWrapper, unwrapFilter?: UIFilterUnwrapper, wrapper?: WrapperFilter}) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter
        this.name = data.name;
        this.wrapper = data.wrapper;
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const {markerValue: unwrapped, isInverted} = unwrapFilterForBuilder(this, filter)
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
                mode: UINumberFilterMode.Equals
            }, {isInverted})
        }

        const notEquals = unwrapFilterByPath(unwrapped, ['$not', this.key, '$eq']);

        if (typeof notEquals === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: notEquals,
                mode: UINumberFilterMode.NotEquals
            }, {isInverted})
        }

        const lessThan = unwrapFilterByPath(unwrapped, [this.key, '$lt']);

        if (typeof lessThan === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: lessThan,
                mode: UINumberFilterMode.LessThan
            }, {isInverted})
        }

        const greaterThan = unwrapFilterByPath(unwrapped, [this.key, '$gt']);

        if (typeof greaterThan === 'number') {
            return new NumberUIFilter({
                builder: this,
                value: greaterThan,
                mode: UINumberFilterMode.GreaterThan
            }, {isInverted})
        }

        return null;
    }
    
    create(options: {isInverted?: boolean} = {}): NumberUIFilter {
        return new NumberUIFilter({
            builder: this,
            value: 0
        }, options)
    }
}
