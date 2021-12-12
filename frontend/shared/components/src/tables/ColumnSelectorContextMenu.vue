<template>
    <ContextMenu v-bind="{...$attrs}">
        <ContextMenuItem v-for="column of columns" :key="column.id" element-name="label" @click="setColumnEnabled(column, !column.enabled)">
            <Checkbox slot="left" :checked="column.enabled" :only-line="true" />
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
    @Prop({ required: true })
    columns: Column<any, any>[];

    setColumnEnabled(column: Column<any, any>, enabled: boolean) {
        console.log("Set column enabled", column, enabled);
        column.width = null
        column.enabled = enabled
    }

}
</script>
