<template>
    <ContextMenu v-bind="{ x, y, preferredWidth }">
        <ContextMenuItem @click="setAlways">
            Altijd vragen
        </ContextMenuItem>
        <ContextMenuItem @click="editFilter()">
            Vragen als filter...
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
export default class PropertyEnabledContextMenu extends Mixins(NavigationMixin) {    
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
    selectedFilter!: FilterGroup<any>

    @Prop()
    handler!: (enabledWhen: FilterGroup<any>) => void

    setAlways() {
        this.handler(new FilterGroup(this.definitions))
    }

    editFilter() {
        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Vragen als...",
            selectedFilter: this.selectedFilter,
            setFilter: this.handler,
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }
}
</script>
