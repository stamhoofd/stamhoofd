import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';
import { unwrapFilterByPath } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import type { StyledDescriptionChoice, UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper } from './UIFilter';
import { UIFilter, unwrapFilterForBuilder } from './UIFilter';

export enum UIDateFilterMode {
    GreaterThan = 'GreaterThan',
    LessThan = 'LessThan',
    Equals = 'Equals',
    NotEquals = 'NotEquals',
}

function getBeginningOfDay(date: Date | null): Date | null {
    if (date === null) {
        return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEndOfDay(date: Date | null): Date | null {
    if (date === null) {
        return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export class DateUIFilter extends UIFilter<DateFilterBuilder> {
    value: Date | null = new Date();
    mode: UIDateFilterMode = UIDateFilterMode.Equals;

    // idea: add possibility to choose time also
    constructor(data: Partial<DateUIFilter>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        switch (this.mode) {
            case UIDateFilterMode.Equals: return {
                $and: [
                    {
                        [this.builder.key]: {
                            $gte: getBeginningOfDay(this.value),
                        },
                    },
                    {
                        [this.builder.key]: {
                            $lte: getEndOfDay(this.value),
                        },
                    },
                ],
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
        return AsyncComponent(() => import('./DateUIFilterView.vue'), {
            filter: this,
        });
    }

    getCombinationWord(mode: UIDateFilterMode): string {
        switch (mode) {
            case UIDateFilterMode.GreaterThan: return $t(`is na`);
            case UIDateFilterMode.LessThan: return $t(`is voor`);
            case UIDateFilterMode.Equals: return $t(`is`);
            case UIDateFilterMode.NotEquals: return $t(`is niet`);
        }
    }

    get combinationWord(): string {
        return this.getCombinationWord(this.mode);
    }

    get styledDescription() {
        const choices: StyledDescriptionChoice[] = Object.values(UIDateFilterMode)
            .map((mode) => {
                return {
                    id: mode,
                    text: this.getCombinationWord(mode),
                    action: () => this.mode = mode,
                    isSelected: () => this.mode === mode,
                };
            });

        return [
            {
                text: this.builder.name,
                style: '',
            },
            {
                text: ' ' + this.combinationWord + ' ',
                style: 'gray',
                choices,
            }, {
                text: this.value ? Formatter.date(this.value, true) : $t('leeg'),
                style: '',
            },
        ];
    }
}

export class DateFilterBuilder implements UIFilterBuilder<DateUIFilter> {
    key = '';
    name = '';
    nullable = false;
    wrapFilter?: UIFilterWrapper | null;
    unwrapFilter?: UIFilterUnwrapper | null;
    wrapper?: WrapperFilter;

    constructor(data: { key: string; name: string; nullable?: boolean; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter }) {
        this.key = data.key;
        this.nullable = data.nullable ?? false;
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

        if (equals instanceof Date || (equals === null && this.nullable)) {
            return new DateUIFilter({
                builder: this,
                value: equals,
                mode: UIDateFilterMode.Equals,
            }, { isInverted });
        }

        const notEquals = unwrapFilterByPath(unwrapped, ['$not', this.key, '$eq']);

        if (notEquals instanceof Date || (notEquals === null && this.nullable)) {
            return new DateUIFilter({
                builder: this,
                value: notEquals,
                mode: UIDateFilterMode.NotEquals,
            }, { isInverted });
        }

        const lessThan = unwrapFilterByPath(unwrapped, [this.key, '$lt']);

        if (lessThan instanceof Date || (lessThan === null && this.nullable)) {
            return new DateUIFilter({
                builder: this,
                value: lessThan,
                mode: UIDateFilterMode.LessThan,
            }, { isInverted });
        }

        const greaterThan = unwrapFilterByPath(unwrapped, [this.key, '$gt']);

        if (greaterThan instanceof Date || (greaterThan === null && this.nullable)) {
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
