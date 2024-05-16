import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdCompareValue, StamhoofdFilter } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import MultipleChoiceUIFilterView from "./MultipleChoiceUIFilterView.vue";
import { UIFilter, UIFilterBuilder, UIFilterWrapper } from "./UIFilter";

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

    doBuild(): StamhoofdFilter|null {
        if (this.options.length === 0) {
            return null;
        }
        return this.builder.buildFilter(this.options.map(o => o.value))
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

export class MultipleChoiceFilterBuilder implements UIFilterBuilder<MultipleChoiceUIFilter> {
    name = ""
    options: MultipleChoiceUIFilterOption[] = []
    buildFilter: FilterWrapper

    constructor(data: {name: string, options: MultipleChoiceUIFilterOption[], buildFilter: FilterWrapper}) {
        this.name = data.name;
        this.options = data.options;
        this.buildFilter = data.buildFilter
    }
    wrapFilter?: UIFilterWrapper | null | undefined;
    
    fromFilter(_filter: StamhoofdFilter): UIFilter | null {
        return null;
    }
    
    create(): MultipleChoiceUIFilter {
        return new MultipleChoiceUIFilter({
            builder: this,
            options: []
        })
    }
}
