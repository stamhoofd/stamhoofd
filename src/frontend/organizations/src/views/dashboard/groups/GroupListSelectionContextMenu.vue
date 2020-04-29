<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="excel">
            Etiketten maken
        </ContextMenuItem>

        <ContextMenuLine />
        <ContextMenuItem @click="excel">
            Exporteer als Excel
        </ContextMenuItem>
        <ContextMenuItem @click="excel">
            Exporteer als CSV
        </ContextMenuItem>
        <ContextMenuLine />
        <ContextMenuItem @click="sms">
            SMS'en
        </ContextMenuItem>
        <ContextMenuItem @click="mail">
            Mailen
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { Member } from "@stamhoofd-frontend/models";
import { MemberExcelExport } from "@stamhoofd/organizations/src/classes/MemberExcelExport";
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import ContextMenu from "@stamhoofd/shared/components/overlays/ContextMenu.vue";
import ContextMenuItem from "@stamhoofd/shared/components/overlays/ContextMenuItem.vue";
import ContextMenuLine from "@stamhoofd/shared/components/overlays/ContextMenuLine.vue";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../mail/MailView.vue";
import SMSView from "../sms/SMSView.vue";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine,
    },
})
export default class GroupListSelectionContextMenu extends Mixins(NavigationMixin) {
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    members!: Member[];

    sms() {
        const displayedComponent = new ComponentWithProperties(SMSView, {
            members: this.members,
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
    mail() {
        const displayedComponent = new ComponentWithProperties(MailView, {
            members: this.members,
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    excel() {
        MemberExcelExport.export(this.members);
    }
}
</script>
