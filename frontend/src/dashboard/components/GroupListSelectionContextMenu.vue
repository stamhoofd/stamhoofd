<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="excel">Etiketten maken</ContextMenuItem>
        <ContextMenuItem @click="excel"></ContextMenuItem>

        <ContextMenuLine />
        <ContextMenuItem @click="excel">Exporteer als Excel</ContextMenuItem>
        <ContextMenuItem @click="excel">Exporteer als CSV</ContextMenuItem>
        <ContextMenuLine />
        <ContextMenuItem @click="sms">SMS'en</ContextMenuItem>
        <ContextMenuItem @click="mail">Mailen</ContextMenuItem>
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
import { MemberExcelExport } from "../classes/MemberExcelExport";
import MailView from "./mail/MailView.vue";

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
    mail() {
        var displayedComponent = new ComponentWithProperties(MailView, {
            members: this.members
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    excel() {
        MemberExcelExport.export(this.members);
    }
}
</script>
