import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { StamhoofdFilter } from "@stamhoofd/structures";
import GroupUIFilterView from "./GroupUIFilterView.vue";
import { UIFilter, UIFilterBuilder, UIFilterWrapper } from "./UIFilter";

export class GroupUIFilter extends UIFilter {
    filters: UIFilter[] = []
    builder: GroupUIFilterBuilder

    get builders() {
        return this.builder.builders
    }

    doBuild(): StamhoofdFilter|null {
        if (!this.filters.length) {
            return null
        }

        const buildFilters = this.filters.map(b => b.build()).filter(f => f !== null) as StamhoofdFilter[];
        if (buildFilters.length === 0) {
            return null;
        }

        if (buildFilters.length === 1) {
            return buildFilters[0];
        }
        
        return {
            '$and': buildFilters
        };
    }

    clone() {
        const c = super.clone() as GroupUIFilter;
        c.filters = this.filters.map(f => f.clone());
        return c;
    }

    flatten() {
        if (this.filters.length === 1 && !this.builder.wrapFilter) {
            return this.filters[0];
        }

        return super.flatten()
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
    wrapFilter?: UIFilterWrapper|null
    
    constructor({builders, name, wrapFilter}: {builders: UIFilterBuilder[], name?: string, wrapFilter?: UIFilterWrapper|null}) {
        this.builders = builders
        this.name = name ?? this.name
        this.wrapFilter = wrapFilter ?? null
    }

    create(): GroupUIFilter {
        return new GroupUIFilter({
            builder: this
        })
    }
        
}