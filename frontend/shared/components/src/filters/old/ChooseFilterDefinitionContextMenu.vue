<template>
    <ContextMenuView v-bind="{ x, y }">
        <ContextMenuItemView v-for="definition in definitions" :key="definition.id" @click="chooseDefinition(definition)">
            {{ definition.name }}
        </ContextMenuItemView>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenuItemView, ContextMenuLine,ContextMenuView } from "@stamhoofd/components";
import { Filter, FilterDefinition } from "@stamhoofd/structures";
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
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
