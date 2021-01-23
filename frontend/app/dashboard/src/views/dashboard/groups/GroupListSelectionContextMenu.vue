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

        <ContextMenuLine />

        <ContextMenuItem @click="deleteRegistration">
            Uitschrijven
            <span slot="right" class="icon unregister" />
        </ContextMenuItem>
        <ContextMenuItem @click="deleteData">
            <span slot="right" class="icon trash" />
            Verwijderen
        </ContextMenuItem>

    </ContextMenu>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageButton, ContextMenu, Toast } from "@stamhoofd/components";
import { ContextMenuItem } from "@stamhoofd/components";
import { ContextMenuLine } from "@stamhoofd/components";
import { Group, MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";
import { MemberManager } from "../../../classes/MemberManager";

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

    deleteData() {
        new CenteredMessage("Wil je alle data van "+this.members.length+" leden verwijderen?", "Dit verwijdert alle data van de geselecteerde leden, inclusief betalingsgeschiedenis. Als er accounts zijn die enkel aangemaakt zijn om dit lid in te schrijven worden deze ook verwijderd. Je kan dit niet ongedaan maken.")
            .addButton(new CenteredMessageButton("Verwijderen", {
                action: async () => {
                    for (const member of this.members) {
                        await MemberManager.deleteMember(member)
                        new Toast(member.firstName+' is verwijderd', "success").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRegistration() {
        new CenteredMessage("Ben je zeker dat je de inschrijving van "+this.members.length+" leden wilt verwijderen?", "De gegevens van de leden blijven (tijdelijk) toegankelijk voor het lid zelf en die kan zich later eventueel opnieuw inschrijven zonder alles opnieuw in te geven.")
            .addButton(new CenteredMessageButton("Uitschrijven", {
                action: async () => {
                    // todo
                    for (const member of this.members) {
                        await MemberManager.unregisterMember(member)
                        new Toast(member.firstName+' is uitgeschreven', "success").show()
                    }
                },
                type: "destructive",
                icon: "unregister"
            }))
            .addCloseButton("Annuleren")
            .show()
    }
}
</script>
