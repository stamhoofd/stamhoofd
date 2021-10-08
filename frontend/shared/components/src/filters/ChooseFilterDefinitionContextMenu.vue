<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem v-for="definition in definitions" :key="definition.id" @click="chooseDefinition(definition)">
            {{ definition.name }}
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, ContextMenuLine } from "@stamhoofd/components";
import { Filter, FilterDefinition } from "@stamhoofd/structures";
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine
    },
})
export default class ChooseFilterDefinitionContextMenu extends Mixins(NavigationMixin) {    
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop({ required: true })
    definitions!: FilterDefinition<any, Filter<any>, any>[]

    @Prop()
    handler!: (definition: FilterDefinition<any, Filter<any>, any>) => void
   
    chooseDefinition(definition) {
        this.handler(definition)
    }
}
</script>
