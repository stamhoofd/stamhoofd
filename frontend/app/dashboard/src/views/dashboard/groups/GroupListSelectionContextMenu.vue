<template>
    <ContextMenu v-bind="{ x, y }">
        <!--<ContextMenuItem @click="excel">
            Etiketten maken
        </ContextMenuItem>

        <ContextMenuLine />-->
        <ContextMenuItem v-if="!waitingList && !isNative" @click="samenvatting">
            Samenvatting
        </ContextMenuItem>
        <ContextMenuItem v-if="!isNative" @click="excel">
            Exporteer als Excel
        </ContextMenuItem>
        <!--<ContextMenuItem @click="excel">
            Exporteer als CSV
        </ContextMenuItem>-->
        <ContextMenuLine v-if="!isNative" />
        <ContextMenuItem @click="sms">
            SMS'en
        </ContextMenuItem>
        <ContextMenuItem @click="mail">
            Mailen
        </ContextMenuItem>

        <ContextMenuLine />

        <ContextMenuItem v-if="waitingList && hasWrite" @click="acceptWaitingList">
            Schrijf in
        </ContextMenuItem>
        <ContextMenuItem v-else-if="hasWaitingList && hasWrite" @click="moveToWaitingList">
            Verplaatst naar wachtlijst
            <span slot="right" class="icon clock-small" />
        </ContextMenuItem>

        <ContextMenuItem v-if="hasWrite" @click="deleteRegistration">
            Uitschrijven
            <span slot="right" class="icon unregister" />
        </ContextMenuItem>
        <ContextMenuItem v-if="hasWrite" @click="deleteRecords">
            <span slot="right" class="icon trash" />
            Gegevens gedeeltelijk wissen
        </ContextMenuItem>
        <ContextMenuItem v-if="hasWrite" @click="deleteData">
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
import { AppManager } from "@stamhoofd/networking";
import { getPermissionLevelNumber, Group, MemberWithRegistrations, PermissionLevel } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";
import MailView from "../mail/MailView.vue";
import MemberSummaryBuilderView from "../member/MemberSummaryBuilderView.vue";
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

    @Prop({ default: null })
    group: Group | null;

    @Prop({ default: 0 })
    cycleOffset!: number

    @Prop({ default: false })
    waitingList!: boolean

    get isNative() {
        return AppManager.shared.isNative
    }

    get hasWrite() {
        if (!OrganizationManager.user.permissions) {
            return false
        }

        if (this.group && (!this.group.privateSettings || getPermissionLevelNumber(this.group.privateSettings.permissions.getPermissionLevel(OrganizationManager.user.permissions)) < getPermissionLevelNumber(PermissionLevel.Write))) {
            return false
        }

        for (const member of this.members) {
            for (const group of member.groups) {
                if (!group.privateSettings || getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(OrganizationManager.user.permissions)) < getPermissionLevelNumber(PermissionLevel.Write)) {
                    return false
                }
            }
        }
        
        return true
    }
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
            root: new ComponentWithProperties(MemberSummaryBuilderView, {
                members: this.members,
                group: this.group
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    get hasWaitingList() {
        return this.group?.hasWaitingList() ?? false
    }

    async excel() {
        try {
            const d = await import(/* webpackChunkName: "MemberExcelExport" */ "../../../classes/MemberExcelExport");
            const MemberExcelExport = d.MemberExcelExport
            MemberExcelExport.export(this.members);
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
    }

    acceptWaitingList() {
        new CenteredMessage("Wil je "+this.members.length+" leden inschrijven?", "We raden sterk aan om leden enkel toe te voegen via de 'toelaten' knop. Dan zijn ze verplicht om de rest van hun gegevens aan te vullen en de betaling in orde te brengen.")
            .addButton(new CenteredMessageButton("Meteen inschrijven", {
                action: async () => {
                    await MemberManager.acceptFromWaitingList(this.members, this.group, this.cycleOffset)
                    new Toast(this.members.length+" leden zijn ingeschreven", "success green").show()
                },
                type: "destructive",
                icon: "download"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRecords() {
        new CenteredMessage("Gegevens van "+this.members.length+" leden wissen", "Opgelet, je kan dit niet ongedaan maken! Deze functie houdt de leden wel in het systeem, maar verwijdert een deel van de gegevens (o.a. handig om in orde te zijn met GDPR).")
            .addButton(new CenteredMessageButton("Behoud contactgegevens", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam, e-mailadres en telefoonnummer (van leden zelf en ouders indien -18jaar) worden verwijderd.")) {
                        await MemberManager.deleteDataExceptContacts(this.members)
                        new Toast("De steekkaart van "+this.members.length+" leden is verwijderd.", "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addButton(new CenteredMessageButton("Behoud enkel naam", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je zeker?", "Verwijder", "Alle gegevens van deze leden, met uitzondering van hun voor- en achternaam worden verwijderd.")) {
                        await MemberManager.deleteData(this.members)
                        new Toast("De steekkaart van "+this.members.length+" leden is verwijderd.", "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    moveToWaitingList() {
        new CenteredMessage("Wil je "+this.members.length+" leden naar de wachtlijst verplaatsen?")
            .addButton(new CenteredMessageButton("Naar wachtlijst", {
                action: async () => {
                    await MemberManager.moveToWaitingList(this.members, this.group, this.cycleOffset)
                    new Toast(this.members.length+" leden zijn naar de wachtlijst verplaatst", "success green").show()
                },
                type: "destructive",
                icon: "clock"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteData() {
        new CenteredMessage("Wil je alle data van "+this.members.length+" leden verwijderen?", "Dit verwijdert alle data van de geselecteerde leden, inclusief betalingsgeschiedenis. Als er accounts zijn die enkel aangemaakt zijn om dit lid in te schrijven worden deze ook verwijderd. Je kan dit niet ongedaan maken.")
            .addButton(new CenteredMessageButton("Verwijderen", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, definitief verwijderen")) {
                        await MemberManager.deleteMembers(this.members)
                        new Toast(this.members.length+" leden zijn verwijderd", "success green").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRegistration() {
        new CenteredMessage("Ben je zeker dat je "+this.members.length+" leden wilt uitschrijven?", "De gegevens van de leden blijven (tijdelijk) toegankelijk voor het lid zelf en die kan zich later eventueel opnieuw inschrijven zonder alles opnieuw in te geven.")
            .addButton(new CenteredMessageButton("Uitschrijven", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, uitschrijven")) {
                        await MemberManager.unregisterMembers(this.members, this.group, this.cycleOffset, this.waitingList)
                        new Toast(this.members.length+" leden zijn uitgeschreven", "success green").show()
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
