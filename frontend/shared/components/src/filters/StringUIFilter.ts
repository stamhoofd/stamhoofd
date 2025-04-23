import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { FilterWrapperMarker, StamhoofdFilter, unwrapFilter, unwrapFilterByPath, WrapperFilter } from '@stamhoofd/structures';

import StringUIFilterView from './StringUIFilterView.vue';
import { StyledDescriptionChoice, UIFilter, UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper, unwrapFilterForBuilder } from './UIFilter';

export enum StringFilterMode {
    Contains = 'Contains',
    Equals = 'Equals',
    NotContains = 'NotContains',
    NotEquals = 'NotEquals',
    NotEmpty = 'NotEmpty',
    Empty = 'Empty',
}

export class StringUIFilter extends UIFilter {
    builder!: StringFilterBuilder;
    value = '';
    mode: StringFilterMode = StringFilterMode.Equals;

    constructor(data: Partial<StringUIFilter>, options: { isInverted?: boolean } = {}) {
        super(data, options);
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        switch (this.mode) {
            case StringFilterMode.Contains: return {
                [this.builder.key]: {
                    $contains: this.value,
                },
            };

            case StringFilterMode.NotContains: return {
                $not: {
                    [this.builder.key]: {
                        $contains: this.value,
                    },
                },
            };

            case StringFilterMode.Equals: return {
                [this.builder.key]: {
                    $eq: this.value,
                },
            };

            case StringFilterMode.NotEquals: return {
                $not: {
                    [this.builder.key]: {
                        $eq: this.value,
                    },
                },
            };

            case StringFilterMode.Empty: return {
                $or: [
                    {
                        [this.builder.key]: {
                            $eq: '',
                        },
                    },
                    {
                        [this.builder.key]: {
                            $eq: null,
                        },
                    },
                ],
            };

            case StringFilterMode.NotEmpty: return {
                $not: {
                    $or: [
                        {
                            [this.builder.key]: {
                                $eq: '',
                            },
                        },
                        {
                            [this.builder.key]: {
                                $eq: null,
                            },
                        },
                    ],
                },
            };
        }
    }

    flatten() {
        if (this.mode === StringFilterMode.Equals && this.value === '') {
            this.mode = StringFilterMode.Empty;
        }
        if (this.mode === StringFilterMode.NotEquals && this.value === '') {
            this.mode = StringFilterMode.NotEmpty;
        }

        return super.flatten();
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(StringUIFilterView, {
            filter: this,
        });
    }

    get combinationWord(): string {
        return this.createCominationWord(this.mode);
    }

    get ignoreValue(): boolean {
        switch (this.mode) {
            case StringFilterMode.Empty: return true;
            case StringFilterMode.NotEmpty: return true;
        }
        return false;
    }

    get styledDescription() {
        const choices: StyledDescriptionChoice[] = Object.values(StringFilterMode)
            .map((mode) => {
                return {
                    id: mode,
                    text: this.createCominationWord(mode),
                    action: () => this.mode = mode,
                    isSelected: () => this.mode === mode,
                };
            });

        if (this.ignoreValue) {
            return [
                {
                    text: this.builder.name,
                    style: '',
                },
                {
                    text: ' ' + this.combinationWord,
                    style: 'gray',
                    choices,
                },
            ];
        }

        return [
            {
                text: this.builder.name,
                style: '',
            },
            {
                text: ' ' + this.combinationWord + ' ',
                style: 'gray',
                choices,
            },
            {
                text: this.value,
                style: '',
            },
        ];
    }

    private createCominationWord(mode: StringFilterMode) {
        switch (mode) {
            case StringFilterMode.Contains: return $t(`2d9129aa-8486-4b20-9ded-fc3550922b2d`);
            case StringFilterMode.NotContains: return $t(`0b2f9da7-c732-4588-a0c0-8de5581ed955`);
            case StringFilterMode.Equals: return $t(`c2dd273a-c50e-4947-88f2-1779acb34495`);
            case StringFilterMode.NotEquals: return $t(`261a6232-3200-434b-b389-53fa0f19e15d`);
            case StringFilterMode.Empty: return $t(`1e6018e6-57e1-4692-a369-ba06998c4b33`);
            case StringFilterMode.NotEmpty: return $t(`e7391885-08d1-4360-99b1-31c65b6eeca7`);
        }
    }
}

export class StringFilterBuilder implements UIFilterBuilder<StringUIFilter> {
    key = '';
    name = '';
    wrapFilter?: UIFilterWrapper | null;
    unwrapFilter?: UIFilterUnwrapper | null;
    wrapper?: WrapperFilter;
    allowCreation?: boolean;

    constructor(data: { key: string; name: string; wrapFilter?: UIFilterWrapper; unwrapFilter?: UIFilterUnwrapper; wrapper?: WrapperFilter; allowCreation?: boolean }) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.wrapper = data.wrapper;
        this.name = data.name;
        this.allowCreation = data.allowCreation;
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const { markerValue: unwrapped, isInverted, match } = unwrapFilterForBuilder(this, filter);

        if (!match || !unwrapped) {
            return null;
        }

        const direcltyEqual = unwrapFilter(unwrapped, {
            [this.key]: FilterWrapperMarker,
        });

        if (direcltyEqual.match && typeof direcltyEqual.markerValue === 'string') {
            return new StringUIFilter({
                builder: this,
                value: direcltyEqual.markerValue,
                mode: StringFilterMode.Equals,
            }, { isInverted });
        }

        if (typeof unwrapped === 'string') {
            return new StringUIFilter({
                builder: this,
                value: unwrapped,
                mode: StringFilterMode.Equals,
            }, { isInverted });
        }

        if (!(typeof unwrapped === 'object')) {
            return null;
        }

        const contains = unwrapFilterByPath(unwrapped, [this.key, '$contains']);

        if (contains && typeof contains === 'string') {
            return new StringUIFilter({
                builder: this,
                value: contains,
                mode: StringFilterMode.Contains,
            }, { isInverted });
        }

        const notContains = unwrapFilterByPath(unwrapped, ['$not', this.key, '$contains']);

        if (notContains && typeof notContains === 'string') {
            return new StringUIFilter({
                builder: this,
                value: notContains,
                mode: StringFilterMode.NotContains,
            }, { isInverted });
        }

        const equals = unwrapFilterByPath(unwrapped, [this.key, '$eq']);

        if (equals && typeof equals === 'string') {
            return new StringUIFilter({
                builder: this,
                value: equals,
                mode: StringFilterMode.Equals,
            }, { isInverted });
        }

        const notEquals = unwrapFilterByPath(unwrapped, ['$not', this.key, '$eq']);

        if (notEquals && typeof notEquals === 'string') {
            return new StringUIFilter({
                builder: this,
                value: notEquals,
                mode: StringFilterMode.NotEquals,
            }, { isInverted });
        }

        const empty = unwrapFilterByPath(unwrapped, ['$or', 0, this.key, '$eq']);

        if (empty === '') {
            return new StringUIFilter({
                builder: this,
                value: '',
                mode: StringFilterMode.Empty,
            }, { isInverted });
        }

        const notEmpty = unwrapFilterByPath(unwrapped, ['$not', '$or', 0, this.key, '$eq']);

        if (notEmpty === '') {
            return new StringUIFilter({
                builder: this,
                value: '',
                mode: StringFilterMode.NotEmpty,
            }, { isInverted });
        }

        return null;
    }

    create(options: { isInverted?: boolean } = {}): StringUIFilter {
        return new StringUIFilter({
            builder: this,
            value: '',
        }, options);
    }
}
