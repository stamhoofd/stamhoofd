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

export class MultipleChoiceUIFilter extends UIFilter {
    builder: MultipleChoiceFilterBuilder
    options: MultipleChoiceUIFilterOption[] = []

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
                        text: 'is',
                        action: () => {
                            this.isInverted = false;
                        },
                        isSelected: () => !this.isInverted
                    },
                    {
                        id: 'is not',
                        text: 'is niet',
                        action: () => {
                            this.isInverted = true;
                        },
                        isSelected: () => this.isInverted
                    }
                ]
            },
            {
                text: Formatter.joinLast(this.options.map(o => o.name), ', ', ' of '),
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
    unwrapFilter?: UIFilterUnwrapper | null | undefined

    constructor(data: {
        name: string, 
        options: MultipleChoiceUIFilterOption[], 
        wrapper?: WrapperFilter,
        wrapFilter?: UIFilterWrapper | null | undefined,
        unwrapFilter?: UIFilterUnwrapper | null | undefined
    }) {
        this.name = data.name;
        this.options = data.options;
        this.wrapper = data.wrapper;
        this.wrapFilter = data.wrapFilter
        this.unwrapFilter = data.unwrapFilter
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
                })
                uiFilter.options = options;

                return uiFilter;
            }
        }

        return null;
    }
    
    create(options: {isInverted?: boolean} = {}): MultipleChoiceUIFilter {
        return new MultipleChoiceUIFilter({
            builder: this
        }, options)
    }
}
