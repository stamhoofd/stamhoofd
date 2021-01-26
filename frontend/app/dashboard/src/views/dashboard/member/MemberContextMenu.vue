<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="editMember">
            Wijzig gegevens
            <span slot="right" class="icon edit" />
        </ContextMenuItem>

        <ContextMenuItem @click="changeGroup">
            Wijzig groep
            <span slot="right" class="icon sync" />
        </ContextMenuItem>

        <template v-if="member.details && member.details.parents.length > 0">
            <ContextMenuLine />
            <ContextMenuItem v-for="(parent, index) in member.details.parents" :key="index" @click="call(parent.phone)">
                Bel {{ parent.firstName }} ({{ ParentTypeHelper.getName(parent.type) }})
            </ContextMenuItem>
            <ContextMenuItem @click="openSMS('parents')">
                Ouders SMS'en
            </ContextMenuItem>
            <ContextMenuItem @click="openMail">
                Ouders e-mailen
            </ContextMenuItem>
        </template>
        <template v-else-if="member.details && member.details.emergencyContacts.length > 0">
            <ContextMenuLine />
            <ContextMenuItem v-for="contact in member.details.emergencyContacts" :key="contact.id" @click="call(contact.phone)">
                Bel {{ contact.name }} (noodcontact)
            </ContextMenuItem>
        </template>

        <template v-if="member.details && member.details.phone">
            <ContextMenuLine />
            <ContextMenuItem @click="call(member.details.phone)">
                Bel {{ member.details.firstName }}
            </ContextMenuItem>
            <ContextMenuItem @click="openSMS('members')">
                SMS {{ member.details.firstName }}
            </ContextMenuItem>
        </template>

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
import { Group, MemberWithRegistrations, ParentTypeHelper } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { MemberManager } from '../../../classes/MemberManager';
import MailView from "../mail/MailView.vue";
import SMSView from "../sms/SMSView.vue";
import EditMemberGroupView from './edit/EditMemberGroupView.vue';
import EditMemberView from './edit/EditMemberView.vue';

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine,
    },
})
export default class MemberContextMenu extends Mixins(NavigationMixin) {
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    member!: MemberWithRegistrations;

    @Prop({ default: null })
    group: Group | null;

    @Prop({ default: 0 })
    cycleOffset!: number

    @Prop({ default: false })
    waitingList!: boolean

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
    }

    call(phone) {
        window.location.href = "tel://" + phone.replace(" ", "");
    }


    editMember() {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditMemberView, {
                member: this.member,
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openMail() {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                members: [this.member],
                group: this.member.groups[0] ?? null
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openSMS(smsFilter = "parents") {
        const displayedComponent = new ComponentWithProperties(SMSView, {
            members: [this.member],
            initialSmsFilter: smsFilter,
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    deleteData() {
        new CenteredMessage("Wil je alle data van "+this.member.firstName+" verwijderen?", "Dit verwijdert alle data van "+this.member.firstName+", inclusief betalingsgeschiedenis. Als er accounts zijn die enkel aangemaakt zijn om dit lid in te schrijven worden deze ook verwijderd. Je kan dit niet ongedaan maken.")
            .addButton(new CenteredMessageButton("Verwijderen", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, definitief verwijderen")) {
                        await MemberManager.deleteMember(this.member)
                        new Toast(this.member.firstName+' is verwijderd', "success").show()
                    }
                },
                type: "destructive",
                icon: "trash"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    deleteRegistration() {
        new CenteredMessage("Ben je zeker dat je "+this.member.firstName+" wilt uitschrijven?", "De gegevens van het lid blijven (tijdelijk) toegankelijk voor het lid zelf en die kan zich later eventueel opnieuw inschrijven zonder alles opnieuw in te geven.")
            .addButton(new CenteredMessageButton("Uitschrijven", {
                action: async () => {
                    if (await CenteredMessage.confirm("Ben je echt heel zeker?", "Ja, uitschrijven")) {
                        await MemberManager.unregisterMember(this.member, this.group, this.cycleOffset, this.waitingList)
                        new Toast(this.member.firstName+' is uitgeschreven', "success").show()
                    }
                },
                type: "destructive",
                icon: "unregister"
            }))
            .addCloseButton("Annuleren")
            .show()
    }

    changeGroup() {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditMemberGroupView, {
                member: this.member,
                memberDetails: this.member.details,
                familyManager: new FamilyManager([this.member])
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>
