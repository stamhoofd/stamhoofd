<template>
    <ContextMenuView v-bind="{ x, y, xPlacement, yPlacement }">
        <ContextMenuItemView @click="setPermission('read')">
            Bekijken
        </ContextMenuItemView>
        <ContextMenuItemView @click="setPermission('write')">
            Bekijken en bewerken
        </ContextMenuItemView>
        <ContextMenuItemView @click="setPermission('full')">
            Volledige toegang
        </ContextMenuItemView>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenuView, ContextMenuItemView, ContextMenuLine, Spinner } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
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
