import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import DateUIFilterView from './DateUIFilterView.vue';
import { UIFilter, UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper, unwrapFilterByPath, unwrapFilterForBuilder, WrapperFilter } from './UIFilter';

export enum UIDateFilterMode {
    GreaterThan = 'GreaterThan',
    LessThan = 'LessThan',
    Equals = 'Equals',
    NotEquals = 'NotEquals',
}

function getBeginningOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEndOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export class DateUIFilter extends UIFilter {
    builder!: DateFilterBuilder;
    value: Date = new Date();
    mode: UIDateFilterMode = UIDateFilterMode.Equals;

    // idea: add possibility to choose time also
    constructor(data: Partial<DateUIFilter>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        switch (this.mode) {
            case UIDateFilterMode.Equals: return {
                [this.builder.key]: {
                    $gte: getBeginningOfDay(this.value),
                    $lte: getEndOfDay(this.value),
                },
            };

            case UIDateFilterMode.NotEquals: return {
                $or: [
                    {
                        [this.builder.key]: {
                            $lt: getBeginningOfDay(this.value),
                        },
                    },
                    {
                        [this.builder.key]: {
                            $gt: getEndOfDay(this.value),
                        },
                    },
                ],
            };

            case UIDateFilterMode.GreaterThan: return {
                [this.builder.key]: {
                    $gt: getEndOfDay(this.value),
                },
            };

            case UIDateFilterMode.LessThan: return {
                [this.builder.key]: {
                    $lt: getBeginningOfDay(this.value),
                },
            };
        }
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(DateUIFilterView, {
            filter: this,
        });
    }

    get combinationWord(): string {
        switch (this.mode) {
            case UIDateFilterMode.GreaterThan: return 'is groter dan';
            case UIDateFilterMode.LessThan: return 'is kleiner dan';
            case UIDateFilterMode.Equals: return 'is gelijk aan';
            case UIDateFilterMode.NotEquals: return 'is niet gelijk aan';
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
                text: Formatter.date(this.value, true),
                style: '',
            },
        ];
    }
}

export class DateFilterBuilder implements UIFilterBuilder<DateUIFilter> {
    key = '';
    name = '';
    wrapFilter?: UIFilterWrapper | null;
    unwrapFilter?: UIFilterUnwrapper | null;
    wrapper?: WrapperFilter;

    constructor(data: { key: string; name: string; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter }) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.name = data.name;
        this.wrapper = data.wrapper;
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

        if (equals instanceof Date) {
            return new DateUIFilter({
                builder: this,
                value: equals,
                mode: UIDateFilterMode.Equals,
            }, { isInverted });
        }

        const notEquals = unwrapFilterByPath(unwrapped, ['$not', this.key, '$eq']);

        if (notEquals instanceof Date) {
            return new DateUIFilter({
                builder: this,
                value: notEquals,
                mode: UIDateFilterMode.NotEquals,
            }, { isInverted });
        }

        const lessThan = unwrapFilterByPath(unwrapped, [this.key, '$lt']);

        if (lessThan instanceof Date) {
            return new DateUIFilter({
                builder: this,
                value: lessThan,
                mode: UIDateFilterMode.LessThan,
            }, { isInverted });
        }

        const greaterThan = unwrapFilterByPath(unwrapped, [this.key, '$gt']);

        if (greaterThan instanceof Date) {
            return new DateUIFilter({
                builder: this,
                value: greaterThan,
                mode: UIDateFilterMode.GreaterThan,
            }, { isInverted });
        }

        return null;
    }

    create(options: { isInverted?: boolean } = {}): DateUIFilter {
        return new DateUIFilter({
            builder: this,
            value: new Date(),
        }, options);
    }
}
