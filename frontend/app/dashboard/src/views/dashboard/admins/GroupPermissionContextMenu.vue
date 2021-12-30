<template>
    <ContextMenu v-bind="{ x, y, xPlacement, yPlacement }">
        <ContextMenuItem @click="setPermission('read')">
            Bekijken
        </ContextMenuItem>
        <ContextMenuItem @click="setPermission('write')">
            Bekijken en bewerken
        </ContextMenuItem>
        <ContextMenuItem @click="setPermission('full')">
            Volledige toegang
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, ContextMenuLine, Spinner } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine,
        Spinner
    },
})
export default class GroupPermissionContextMenu extends Mixins(NavigationMixin) {    
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    xPlacement?: string;

    @Prop()
    yPlacement?: string;

    @Prop()
    callback!: (status: "read" | "write" | "full") => void;

    setPermission(status) {
        this.callback(status)
    }
}
</script>
