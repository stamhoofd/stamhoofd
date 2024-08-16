import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdCompareValue, StamhoofdFilter } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import MultipleChoiceUIFilterView from "./MultipleChoiceUIFilterView.vue";
import { UIFilter, UIFilterBuilder, UIFilterWrapper, unwrapFilterForBuilder, WrapperFilter } from "./UIFilter";

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

    get styledDescription() {
        return [
            {
                text: this.builder.name,
                style: ''
            },
            {
                text: ' is ',
                style: 'gray'
            }, {
                text: Formatter.joinLast(this.options.map(o => o.name), ', ', ' of '),
                style: ''
            }
        ]
    }
}

type FilterWrapper = ((values: StamhoofdCompareValue[]) => StamhoofdFilter);
type FilterUnwrapper = ((filter: StamhoofdFilter) => unknown);

export class MultipleChoiceFilterBuilder implements UIFilterBuilder<MultipleChoiceUIFilter> {
    name = ""
    options: MultipleChoiceUIFilterOption[] = []
    wrapper?: WrapperFilter;
    buildFilter?: FilterWrapper
    unbuildFilter?: FilterUnwrapper | null | undefined;

    constructor(data: {
        name: string, 
        options: MultipleChoiceUIFilterOption[], 
        wrapper?: WrapperFilter,
        buildFilter?: FilterWrapper,
        unbuildFilter?: FilterUnwrapper | null | undefined
    }) {
        this.name = data.name;
        this.options = data.options;
        this.wrapper = data.wrapper;
        this.buildFilter = data.buildFilter
        this.unbuildFilter = data.unbuildFilter
    }

    wrapFilter?: UIFilterWrapper | null | undefined;
    
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
    
    create(): MultipleChoiceUIFilter {
        return new MultipleChoiceUIFilter({
            builder: this
        })
    }
}
