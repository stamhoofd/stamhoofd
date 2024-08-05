import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter } from "@stamhoofd/structures";

import GroupUIFilterView from "./GroupUIFilterView.vue";
import { UIFilter, UIFilterBuilder, UIFilterWrapper } from "./UIFilter";
import { UnknownFilterBuilder } from "./UnknownUIFilter";

export enum GroupUIFilterMode {
    Or = "Or",
    And = "And",
}

export class GroupUIFilter extends UIFilter {
    filters: UIFilter[] = []
    builder!: GroupUIFilterBuilder
    mode: GroupUIFilterMode = GroupUIFilterMode.And

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
            [this.mode === GroupUIFilterMode.And ? '$and' : '$or']: buildFilters
        };
    }

    clone() {
        const c = super.clone() as GroupUIFilter;
        c.filters = this.filters.map(f => f.clone());
        c.mode = this.mode;
        return c;
    }

    flatten() {
        if (this.filters.length === 0) {
            return null;
        }
        
        let flattened = this.builder.wrapFilter ? this.filters.slice() : this.filters.map(f => f?.flatten()).filter(f => !!f);
        
        flattened = flattened.flatMap(f => {
            if (f instanceof GroupUIFilter && f.mode === this.mode) {
                return f.filters
            }
            return f
        })

        if (flattened.length === 0) {
            return null;
        }

        if (flattened.length === 1 && !this.builder.wrapFilter) {
            return flattened[0]
        }

        const clone = this.clone();
        clone.filters = flattened as UIFilter[];
        return clone;
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
        flattened.push({text: this.mode === GroupUIFilterMode.And ? ' en ' : ' of ', style: 'gray'})
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

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        let allowSelf = false;
        let mode = GroupUIFilterMode.And;
        if (typeof filter === 'object' && filter !== null && ("$and" in filter)) {
            filter = filter.$and;
            allowSelf = true;
            mode = GroupUIFilterMode.And;
        }

        if (typeof filter === 'object' && filter !== null && ("$or" in filter)) {
            filter = filter.$or;
            allowSelf = true;
            mode = GroupUIFilterMode.Or;
        }

        // Match
        const subfilters: UIFilter[] = [];

        for (const f of Array.isArray(filter) ? filter : [filter]) {
            for (const builder of [...this.builders, new UnknownFilterBuilder()]) {
                if (builder === this && !allowSelf) {
                    continue;
                }
                const decoded = builder.fromFilter(f);
                if (decoded !== null) {
                    subfilters.push(decoded);
                    break;
                }
            }

            // todo: add default encoding here
        }

        const groupFilter = this.create();
        groupFilter.filters = subfilters;
        groupFilter.mode = mode;
        return groupFilter;
    }
}
