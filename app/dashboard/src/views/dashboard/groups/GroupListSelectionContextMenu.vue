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
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Member } from "@stamhoofd-frontend/models";
import { ContextMenu } from "@stamhoofd/components";
import { ContextMenuItem } from "@stamhoofd/components";
import { ContextMenuLine } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { MemberExcelExport } from "../../../classes/MemberExcelExport";
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
