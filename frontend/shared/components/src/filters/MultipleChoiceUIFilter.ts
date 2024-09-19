import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdCompareValue, StamhoofdFilter } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import MultipleChoiceUIFilterView from "./MultipleChoiceUIFilterView.vue";
import { StyledDescription, UIFilter, UIFilterBuilder, UIFilterUnwrapper, UIFilterWrapper, unwrapFilterForBuilder, WrapperFilter } from "./UIFilter";

export class MultipleChoiceUIFilterOption {
    name: string;
    value: StamhoofdCompareValue;

    constructor(name: string, value: StamhoofdCompareValue) {
        this.name = name;
        this.value = value;
    }
}

export enum MultipleChoiceUIFilterMode {
    And = 'And',
    Or = 'Or'
}

export class MultipleChoiceUIFilter extends UIFilter {
    builder: MultipleChoiceFilterBuilder
    options: MultipleChoiceUIFilterOption[] = []
    mode: MultipleChoiceUIFilterMode = MultipleChoiceUIFilterMode.Or;

    constructor(data: Partial<UIFilter>, options: {isInverted?: boolean, mode?: MultipleChoiceUIFilterMode} = {}) {
        super(data, options);

        if(options.mode) {
            this.mode = options.mode;
        }
    }

    doBuild(): StamhoofdFilter {
        return this.options.map(o => o.value)
    }

    flatten() {
        if (this.options.length === 0) {
            return null;
        }

        return super.flatten()
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(MultipleChoiceUIFilterView, {
            filter: this
        })
    }

    override get styledDescription(): StyledDescription  {
        const isPlural = this.options.length > 1;
        const lastJoinWord =
            this.mode === MultipleChoiceUIFilterMode.Or
                ? this.isInverted
                    ? "en"
                    : "of"
                : this.isInverted
                    ? "of"
                    : "en";

        return [
            {
                text: this.builder.name,
                style: ''
            },
            {
                text: '',
                style: '',
                choices: [
                    {
                        id: 'is',
                        text: isPlural ? 'zijn' : 'is',
                        action: () => {
                            this.isInverted = false;
                        },
                        isSelected: () => !this.isInverted
                    },
                    {
                        id: 'is not',
                        text: isPlural ? 'zijn niet' : 'is niet',
                        action: () => {
                            this.isInverted = true;
                        },
                        isSelected: () => this.isInverted
                    }
                ]
            },
            {
                text: Formatter.joinLast(this.options.map(o => o.name), ', ', ` ${lastJoinWord} `),
                style: ''
            }
        ]
    }
}

export class MultipleChoiceFilterBuilder implements UIFilterBuilder<MultipleChoiceUIFilter> {
    name = ""
    options: MultipleChoiceUIFilterOption[] = []
    wrapper?: WrapperFilter;
    wrapFilter?: UIFilterWrapper | null | undefined;
    unwrapFilter?: UIFilterUnwrapper | null | undefined;
    mode: MultipleChoiceUIFilterMode = MultipleChoiceUIFilterMode.Or;

    constructor(data: {
        name: string, 
        options: MultipleChoiceUIFilterOption[], 
        wrapper?: WrapperFilter,
        wrapFilter?: UIFilterWrapper | null | undefined,
        unwrapFilter?: UIFilterUnwrapper | null | undefined,
        mode?: MultipleChoiceUIFilterMode
    }) {
        this.name = data.name;
        this.options = data.options;
        this.wrapper = data.wrapper;
        this.wrapFilter = data.wrapFilter
        this.unwrapFilter = data.unwrapFilter

        if(data.mode) {
            this.mode = data.mode;
        }
    }
    
    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const match = unwrapFilterForBuilder(this, filter)
        if (!match.match || match.markerValue === undefined) {
            return null;
        }
        const response = match.markerValue
        
        if (Array.isArray(response)) {
            // Check if all the options are valid
            const options = this.options.filter(o => response.includes(o.value));
            
            if (options.length === response.length) {
                const uiFilter = new MultipleChoiceUIFilter({
                    builder: this
                }, {mode: this.mode, isInverted: match.isInverted})
                uiFilter.options = options;

                return uiFilter;
            }
        }

        return null;
    }
    
    create(options: {isInverted?: boolean} = {}): MultipleChoiceUIFilter {
        return new MultipleChoiceUIFilter({
            builder: this
        }, {...options, mode: this.mode})
    }
}
