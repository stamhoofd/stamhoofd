<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem>Exporteer als Excel</ContextMenuItem>
        <ContextMenuItem @click="sms">SMS'en</ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch, Mixins } from "vue-property-decorator";
import ContextMenu from "shared/components/overlays/ContextMenu.vue";
import ContextMenuItem from "shared/components/overlays/ContextMenuItem.vue";
import ContextMenuLine from "shared/components/overlays/ContextMenuLine.vue";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import { Member } from "shared/models/Member";
import SMSView from "./sms/SMSView.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine
    }
})
export default class GroupListSelectionContextMenu extends Mixins(NavigationMixin) {
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    members!: Member[];

    mounted() {}

    sms() {
        var displayedComponent = new ComponentWithProperties(SMSView, {
            members: this.members
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>
