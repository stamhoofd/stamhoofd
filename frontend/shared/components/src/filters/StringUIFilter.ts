import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter } from "@stamhoofd/structures";

import StringUIFilterView from "./StringUIFilterView.vue";
import { StyledDescriptionChoice, UIFilter, UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper, unwrapFilterByPath, unwrapFilterForBuilder, WrapperFilter } from "./UIFilter";

export enum StringFilterMode {
    Contains = "Contains",
    Equals = "Equals",
    NotContains = "NotContains",
    NotEquals = "NotEquals",
    NotEmpty = "NotEmpty",
    Empty = "Empty"
}

export class StringUIFilter extends UIFilter {
    builder!: StringFilterBuilder
    value = ""
    mode: StringFilterMode = StringFilterMode.Equals

    constructor(data: Partial<StringUIFilter>, options: {isInverted?: boolean} = {}) {
        super(data, options)
        Object.assign(this, data);
    }

    doBuild(): StamhoofdFilter {
        switch (this.mode) {
            case StringFilterMode.Contains: return {
                [this.builder.key]: {
                    "$contains": this.value
                }
            };

            case StringFilterMode.NotContains: return {
                $not: {
                    [this.builder.key]: {
                        "$contains": this.value
                    }
                }
            };

            case StringFilterMode.Equals: return {
                [this.builder.key]: {
                    "$eq": this.value
                }
            };

            case StringFilterMode.NotEquals: return {
                $not: {
                    [this.builder.key]: {
                        "$eq": this.value
                    }
                }
            };

            case StringFilterMode.Empty: return {
                $or: [
                    {
                        [this.builder.key]: {
                            "$eq": ''
                        }
                    },
                    {
                        [this.builder.key]: {
                            "$eq": null
                        }
                    }
                ]
            };

            case StringFilterMode.NotEmpty: return {
                $not: {
                    $or: [
                        {
                            [this.builder.key]: {
                                "$eq": ''
                            }
                        },
                        {
                            [this.builder.key]: {
                                "$eq": null
                            }
                        }
                    ]
                }
            };
        }
    }

    flatten() {
        if (this.mode === StringFilterMode.Equals && this.value === '') {
            this.mode = StringFilterMode.Empty
        }
        if (this.mode === StringFilterMode.NotEquals && this.value === '') {
            this.mode = StringFilterMode.NotEmpty
        }

        return super.flatten()
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(StringUIFilterView, {
            filter: this
        })
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
            .map(mode => {
                return {
                    id: mode,
                    text: this.createCominationWord(mode),
                    action: () => this.mode = mode,
                    isSelected: () => this.mode === mode
                }
            });

        if (this.ignoreValue) {
            return [
                {
                    text: this.builder.name,
                    style: ''
                },
                {
                    text: ' '+ this.combinationWord,
                    style: 'gray',
                    choices
                }
            ]
        }

        return [
            {
                text: this.builder.name,
                style: ''
            },
            {
                text: ' '+ this.combinationWord +' ',
                style: 'gray',
                choices
            },
            {
                text: this.value,
                style: ''
            }
        ]
    }

    private createCominationWord(mode: StringFilterMode) {
        switch (mode) {
            case StringFilterMode.Contains: return 'bevat';
            case StringFilterMode.NotContains: return 'bevat niet';
            case StringFilterMode.Equals: return 'is gelijk aan';
            case StringFilterMode.NotEquals: return 'is niet gelijk aan';
            case StringFilterMode.Empty: return 'is leeg';
            case StringFilterMode.NotEmpty: return 'is niet leeg';
        }
    }
}

export class StringFilterBuilder implements UIFilterBuilder<StringUIFilter> {
    key = ""
    name = ""
    wrapFilter?: UIFilterWrapper | null
    unwrapFilter?: UIFilterUnwrapper | null;
    wrapper?: WrapperFilter;

    constructor(data: {key: string, name: string, wrapFilter?: UIFilterWrapper, unwrapFilter?: UIFilterUnwrapper, wrapper?: WrapperFilter}) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter
        this.wrapper = data.wrapper;
        this.name = data.name;
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const {markerValue: unwrapped, isInverted} = unwrapFilterForBuilder(this, filter)
        
        if (unwrapped === null || unwrapped === undefined) {
            return null;
        }

        if (!(typeof unwrapped === 'object')) {
            return null;
        }

        const contains = unwrapFilterByPath(unwrapped, [this.key, '$contains']);

        if (contains && typeof contains === 'string') {
            return new StringUIFilter({
                builder: this,
                value: contains,
                mode: StringFilterMode.Contains
            }, {isInverted})
        }

        const notContains = unwrapFilterByPath(unwrapped, ['$not', this.key, '$contains']);

        if (notContains && typeof notContains === 'string') {
            return new StringUIFilter({
                builder: this,
                value: notContains,
                mode: StringFilterMode.NotContains
            }, {isInverted})
        }

        const equals = unwrapFilterByPath(unwrapped, [this.key, '$eq']);

        if (equals && typeof equals === 'string') {
            return new StringUIFilter({
                builder: this,
                value: equals,
                mode: StringFilterMode.Equals
            }, {isInverted})
        }

        const notEquals = unwrapFilterByPath(unwrapped, ['$not', this.key, '$eq']);

        if (notEquals && typeof notEquals === 'string') {
            return new StringUIFilter({
                builder: this,
                value: notEquals,
                mode: StringFilterMode.NotEquals
            }, {isInverted})
        }

        const empty = unwrapFilterByPath(unwrapped, ['$or', 0, this.key, '$eq']);

        if (empty === '') {
            return new StringUIFilter({
                builder: this,
                value: '',
                mode: StringFilterMode.Empty
            }, {isInverted})
        }

        const notEmpty = unwrapFilterByPath(unwrapped, ['$not', '$or', 0, this.key, '$eq']);

        if (notEmpty === '') {
            return new StringUIFilter({
                builder: this,
                value: '',
                mode: StringFilterMode.NotEmpty
            }, {isInverted})
        }

        return null;
    }
    
    create(options: {isInverted?: boolean} = {}): StringUIFilter {
        return new StringUIFilter({
            builder: this,
            value: ''
        }, options)
    }
}
