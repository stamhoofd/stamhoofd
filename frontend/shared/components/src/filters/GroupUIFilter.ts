import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { StamhoofdFilter } from "@stamhoofd/structures";
import GroupUIFilterView from "./GroupUIFilterView.vue";
import { UIFilter, UIFilterBuilder } from "./UIFilter";

export class GroupUIFilter extends UIFilter {
    filters: UIFilter[] = []
    builders: UIFilterBuilder[] = []

    constructor(data?: {builders: UIFilterBuilder[], filters?: UIFilter[]}) {
        super();
        this.builders = data?.builders ?? []
        this.filters = data?.filters ?? [];
    }

    build(): StamhoofdFilter {
        if (!this.filters.length) {
            return {};
        }
        
        return {
            '$and': this.filters.map(b => b.build())
        };
    }

    clone() {
        const c = super.clone() as GroupUIFilter;
        c.filters = this.filters.map(f => f.clone());
        return c;
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(GroupUIFilterView, {
            filter: this
        })
    }

    get styledDescription() {
        const array = this.filters.map(b => b.styledDescription)
        const last = array.pop()
        
        if (last === undefined) {
            return []
        }

        if (array.length == 0) {
            return last
        }

        const plast = array.pop()
        const flattened = array.flatMap(a => [...a, {text: ', ', style: 'gray'}])
        if (plast) {
            flattened.push(...plast)
        }
        flattened.push({text: ' en ', style: 'gray'})
        flattened.push(...last)

        return flattened
    }
}

export class GroupUIFilterBuilder implements UIFilterBuilder<GroupUIFilter> {
    builders: UIFilterBuilder[] = []
    name = "Complexe filtergroep"

    constructor({builders}: {builders: UIFilterBuilder[]}) {
        this.builders = builders
    }

    create(): GroupUIFilter {
        return new GroupUIFilter({
            builders: this.builders
        })
    }
        
}