<template>
    <ContextMenu v-bind="{ x, y, xPlacement, yPlacement }">
        <ContextMenuItem v-for="column of columns" :key="column.id" element-name="label">
            <Checkbox slot="left" :checked="column.enabled" :only-line="true" @change="setColumnEnabled(column, $event)" />
            {{ column.name }}
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
    columns: Column<any, any>[];

    setColumnEnabled(column: Column<any, any>, enabled: boolean) {
        column.width = null
        column.enabled = enabled
    }

}
</script>
