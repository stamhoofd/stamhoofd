<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="editMember">
            Wijzig gegevens
            <span class="icon edit" slot="right"/>
        </ContextMenuItem>

        <ContextMenuItem @click="changeGroup">
            Wijzig groep
            <span class="icon sync" slot="right"/>
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
            <span class="icon unregister" slot="right"/>
        </ContextMenuItem>
        <ContextMenuItem @click="deleteData">
            <span class="icon trash" slot="right"/>
            Verwijderen
        </ContextMenuItem>

    </ContextMenu>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, CenteredMessage, Toast } from "@stamhoofd/components";
import { ContextMenuItem } from "@stamhoofd/components";
import { ContextMenuLine } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../mail/MailView.vue";
import SMSView from "../sms/SMSView.vue";
import { MemberWithRegistrations, ParentTypeHelper } from '@stamhoofd/structures';
import EditMemberView from './edit/EditMemberView.vue';
import EditMemberGroupView from './edit/EditMemberGroupView.vue';
import { FamilyManager } from '../../../classes/FamilyManager';
import { MemberManager } from '../../../classes/MemberManager';

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
        this.present(new ComponentWithProperties(CenteredMessage, { 
            title: "Wil je alle data van "+this.member.firstName+" verwijderen?", 
            description: "Dit verwijdert alle data van "+this.member.firstName+", inclusief betalingsgeschiedenis. Als er accounts zijn die enkel aangemaakt zijn om dit lid in te schrijven worden deze ook verwijderd. Je kan dit niet ongedaan maken.", 
            confirmType: "destructive",
            confirmButton: "Verwijderen",
            confirmAction: async () => {
                // todo
                await MemberManager.deleteMember(this.member)
                new Toast(this.member.firstName+' is verwijderd', "success").show()
            },
            closeButton: "Annuleren", 
        }).setDisplayStyle("overlay"))
    }

    deleteRegistration() {
        this.present(new ComponentWithProperties(CenteredMessage, { title: "Binnenkort beschikbaar!", description: "Deze functie is op dit moment nog niet beschikbaar, maar mag je vrij snel verwachten. Contacteer ons gerust als je hierover vragen hebt.", closeButton: "Sluiten", type: "clock" }).setDisplayStyle("overlay"))
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

        //this.present(new ComponentWithProperties(CenteredMessage, { title: "Binnenkort beschikbaar!", description: "Deze functie is op dit moment nog niet beschikbaar, maar mag je vrij snel verwachten. Contacteer ons gerust als je hierover vragen hebt.", closeButton: "Sluiten", type: "clock" }).setDisplayStyle("overlay"))
    }
}
</script>
