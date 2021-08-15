<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="setPermission('read')">
            Bekijken
        </ContextMenuItem>
        <ContextMenuItem @click="setPermission('write')">
            Bekijken en bewerken
        </ContextMenuItem>
        <ContextMenuItem @click="setPermission('manage')">
            Beheren
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
    callback!: (status: "read" | "write" | "manage" | "full") => void;

    setPermission(status) {
        this.callback(status)
    }
}
</script>
