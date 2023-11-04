<template>
    <div class="container">
        <Dropdown v-if="group.filters.length > 1" v-model="mode">
            <option :value="GroupFilterMode.And">
                Alle filters moeten matchen
            </option>
            <option :value="GroupFilterMode.Or">
                Minstens één filter is voldoende
            </option>
            <option :value="GroupFilterMode.Nand">
                Toon resultaten waarbij niet alle filters matchen
            </option>
            <option :value="GroupFilterMode.Nor">
                Toon resultaten waarbij geen enkele filter matcht
            </option>
        </Dropdown>
        <Dropdown v-else-if="group.filters.length === 1" v-model="mode">
            <option :value="GroupFilterMode.And">
                Toon resultaten waarbij de filter matcht
            </option>
            <option :value="GroupFilterMode.Nor">
                Toon resultaten waarbij de filter niet matcht
            </option>
        </Dropdown>

        <div v-for="(filter, index) of group.filters" :key="'filters'+index" class="container">
            <hr>
            <h2 class="style-with-button">
                <div>
                    {{ filter.definition.name }}
                </div>
                <div>
                    <button class="button icon gray trash" type="button" @click="removeFilter(index)" />
                </div>
            </h2>
            <p v-if="filter.definition.description">
                {{ filter.definition.description }}
            </p>
            <StringFilterView v-if="isStringFilter(filter)" :filter="filter" />
            <NumberFilterView v-else-if="isNumberFilter(filter)" :filter="filter" />
            <DateFilterView v-else-if="isDateFilter(filter)" :filter="filter" />
            <ChoicesFilterView v-else-if="isChoicesFilter(filter)" :filter="filter" />
            <RegistrationsFilterView v-else-if="isRegistrationsFilter(filter)" :filter="filter" :organization="organization" />
            <template v-else-if="isFilterGroup(filter)">
                <p v-if="filter.toString()">
                    {{ filter.toString() }}
                </p>
                <button class="button text" type="button" @click="editFilterGroup(filter)">
                    <span class="icon edit" />
                    <span>Wijzigen</span>
                </button>
            </template>
            <p v-else class="error-box">
                Filter niet ondersteund
            </p>
        </div>

        <hr v-if="group.filters.length > 0">

        <p v-for="definition in definitions" :key="definition.id">
            <button class="button text" type="button" @click="addFilter(definition)">
                <span class="icon add" />
                <span>{{ definition.name }}</span>
            </button>
        </p>

        <p v-for="(category, index) in categories" :key="'categories'+index">
            <button class="button text" type="button" @click="openCategory($event, category)">
                <span class="icon add" />
                <span>{{ category.name }}</span>
            </button>
        </p>

        <button class="button text" type="button" @click="addFilterGroup()">
            <span class="icon add" />
            <span>Complexe filtergroep</span>
        </button>
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