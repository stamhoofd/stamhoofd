<template>
    <ContextMenu v-bind="{ x, y, preferredWidth }">
        <ContextMenuItem @click="setRequired">
            Verplicht invullen
        </ContextMenuItem>
        <ContextMenuItem @click="setOptional">
            Optioneel
        </ContextMenuItem>
        <ContextMenuItem @click="editFilter()">
            Aangepast...
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, ContextMenuLine } from "@stamhoofd/components";
import { Filter, FilterDefinition, FilterGroup } from "@stamhoofd/structures";
import { Component, Mixins,Prop } from "vue-property-decorator";

import FilterEditor from "./FilterEditor.vue";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine
    },
})
export default class PropertyRequiredContextMenu extends Mixins(NavigationMixin) {    
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop({
        default: null,
    })
    preferredWidth!: number | null;

    @Prop({ required: true })
    definitions!: FilterDefinition<any, Filter<any>, any>[]

    @Prop({ required: true })
    selectedFilter!: FilterGroup<any> | null

    @Prop()
    handler!: (enabledWhen: FilterGroup<any> | null) => void

    setRequired() {
        this.handler(new FilterGroup(this.definitions))
    }

    setOptional() {
        this.handler(null)
    }

    editFilter() {
        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Verplicht als...",
            selectedFilter: this.selectedFilter,
            setFilter: this.handler,
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }
}
</script>
