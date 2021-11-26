<template>
    <ContextMenu v-bind="{ x, y, xPlacement, yPlacement }">
        <ContextMenuItem v-for="column of columns" :key="column.id">
            <Checkbox v-model="column.enabled">
                {{ column.name }}
            </Checkbox>
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,ContextMenu, ContextMenuItem, ContextMenuLine } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { Column } from "./Column";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine,
        Checkbox
    },
})
export default class ColumnSelectorContextMenu extends Mixins(NavigationMixin) {
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    xPlacement?: string;

    @Prop()
    yPlacement?: string;

    @Prop({ required: true })
    columns: Column<any>[];

}
</script>
