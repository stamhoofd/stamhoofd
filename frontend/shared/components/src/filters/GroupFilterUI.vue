<template>
    <div class="container">
        todo
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Dropdown,FilterEditor,STInputBox, STListItem } from "@stamhoofd/components"
import { ChoicesFilter, DateFilter, Filter, FilterDefinition, FilterGroup, GroupFilterMode, NumberFilter, Organization, RegistrationsFilter, StringFilter } from "@stamhoofd/structures";
import { Component, Mixins,Prop } from "vue-property-decorator";

import ChoicesFilterView from "./ChoicesFilterView.vue"
import ChooseFilterDefinitionContextMenu from "./ChooseFilterDefinitionContextMenu.vue";
import DateFilterView from "./DateFilterView.vue"
import NumberFilterView from "./NumberFilterView.vue"
import RegistrationsFilterView from "./RegistrationsFilterView.vue"
import StringFilterView from "./StringFilterView.vue"

@Component({
    components: {
        STInputBox,
        STListItem,
        StringFilterView,
        NumberFilterView,
        ChoicesFilterView,
        DateFilterView,
        RegistrationsFilterView,
        Dropdown
    }
})
export default class FilterGroupView extends Mixins(NavigationMixin)  {
    @Prop({ required: true }) 
        group: FilterGroup<any>

    @Prop({ required: false })
        organization?: Organization

    get GroupFilterMode() {
        return GroupFilterMode
    }

    get mode() {
        return this.group.mode
    }

    set mode(mode: GroupFilterMode) {
        this.group.mode = mode
    }

    get definitions() {
        const m: FilterDefinition<any, any, any>[] = []

        for (const definition of this.group.getDefinitions()) {
            if (!definition.category || (this.categoryMap.get(definition.category)?.definitions.length ?? 0) <= 1) {
                m.push(definition)
            }
        }

        return m
    }

    get categoryMap() {
        const m = new Map<string, { name: string, definitions: FilterDefinition<any, any, any>[] }>()

        for (const definition of this.group.getDefinitions()) {
            if (definition.category) {
                const existing = m.get(definition.category)
                if (existing) {
                    existing.definitions.push(definition)
                } else {
                    m.set(definition.category, { name: definition.category, definitions: [definition] })
                }
            }
        }

        return m
    }

    get categories() {
        const m = this.categoryMap
        return [...m.values()].filter(m => m.definitions.length > 1)
    }

    openCategory(event, category: { name: string, definitions: FilterDefinition<any, any, any>[] }) {
        const displayedComponent = new ComponentWithProperties(ChooseFilterDefinitionContextMenu, {
            x: event.clientX,
            y: event.clientY + 10,
            definitions: category.definitions,
            handler: (definition) =>  {
                this.addFilter(definition)
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    isStringFilter(filter: Filter<any>): boolean {
        return filter instanceof StringFilter
    }

    isNumberFilter(filter: Filter<any>): boolean {
        return filter instanceof NumberFilter
    }

    isDateFilter(filter: Filter<any>): boolean {
        return filter instanceof DateFilter
    }

    isChoicesFilter(filter: Filter<any>): boolean {
        return filter instanceof ChoicesFilter
    }

    isRegistrationsFilter(filter: Filter<any>): boolean {
        return filter instanceof RegistrationsFilter
    }

    isFilterGroup(filter: Filter<any>): boolean {
        return filter instanceof FilterGroup
    }

    addFilter(definition: FilterDefinition<any, Filter<any>, any>) {
        this.group.filters.push(definition.createFilter())
    }

    addFilterGroup() {
        this.group.filters.push(new FilterGroup<any>(this.group.getDefinitions()))
    }

    editFilterGroup(filter: FilterGroup<any>) {
        const index = this.group.filters.indexOf(filter);
        const displayedComponent = new ComponentWithProperties(FilterEditor, {
            title: 'Filtergroep wijzigen',
            selectedFilter: filter,
            setFilter: (filter) => {
                this.$set(this.group.filters, index, filter)
            },
            definitions: this.group.getDefinitions(),
            organization: this.organization
        });
        this.present({
            components: [displayedComponent],
            modalDisplayStyle: 'sheet'
        });
    }

    removeFilter(index: number) {
        this.group.filters.splice(index, 1)
    }
   
}
</script>