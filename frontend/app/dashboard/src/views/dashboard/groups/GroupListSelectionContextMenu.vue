<template>
    <ContextMenu v-bind="{ x, y }">
        <!--<ContextMenuItem @click="excel">
            Etiketten maken
        </ContextMenuItem>

        <ContextMenuLine />-->
        <ContextMenuItem @click="samenvatting">
            Samenvatting
        </ContextMenuItem>
        <ContextMenuItem @click="excel">
            Exporteer als Excel
        </ContextMenuItem>
        <!--<ContextMenuItem @click="excel">
            Exporteer als CSV
        </ContextMenuItem>-->
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
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu } from "@stamhoofd/components";
import { ContextMenuItem } from "@stamhoofd/components";
import { ContextMenuLine } from "@stamhoofd/components";
import { Group, MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../mail/MailView.vue";
import MemberSummaryView from "../member/MemberSummaryView.vue";
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
    members!: MemberWithRegistrations[];

    @Prop()
    group: Group;

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

    samenvatting() {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberSummaryView, {
                members: this.members,
                group: this.group
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    async excel() {
        const d = await import(/* webpackChunkName: "MemberExcelExport" */ "../../../classes/MemberExcelExport");
        const MemberExcelExport = d.MemberExcelExport
        MemberExcelExport.export(this.members);
    }
}
</script>
