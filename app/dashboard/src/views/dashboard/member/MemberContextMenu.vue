<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="changeGroup">Groep wijzigen</ContextMenuItem>

        <template v-if="member.details && member.details.parents.length > 0">
            <ContextMenuLine />
            <ContextMenuItem v-for="(parent, index) in member.details.parents" :key="index" @click="call(parent.phone)">
                {{ parent.firstName }} ({{ ParentTypeHelper.getName(parent.type) }}) bellen
            </ContextMenuItem>
            <ContextMenuItem @click="openSMS('parents')">
                Ouders SMS'en
            </ContextMenuItem>
            <ContextMenuItem @click="openMail">
                Ouders mailen
            </ContextMenuItem>
        </template>
        <template v-else-if="member.details && member.details.emergencyContacts.length > 0">
            <ContextMenuLine />
            <ContextMenuItem v-for="contact in member.details.emergencyContacts" :key="contact.id" @click="call(contact.phone)">
                {{ contact.name }} (noodcontact) bellen
            </ContextMenuItem>
        </template>

        <template v-if="member.details && member.details.phone">
            <ContextMenuLine />
            <ContextMenuItem @click="call(member.details.phone)">
                {{ member.details.firstName }} bellen
            </ContextMenuItem>
            <ContextMenuItem @click="openSMS('members')">
                {{ member.details.firstName }} SMS'en
            </ContextMenuItem>
        </template>

        <ContextMenuLine />
        <ContextMenuItem @click="deleteRegistration">Uitschrijven</ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, CenteredMessage } from "@stamhoofd/components";
import { ContextMenuItem } from "@stamhoofd/components";
import { ContextMenuLine } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../mail/MailView.vue";
import SMSView from "../sms/SMSView.vue";
import { MemberWithRegistrations, ParentTypeHelper } from '@stamhoofd/structures';

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

    deleteRegistration() {
        this.present(new ComponentWithProperties(CenteredMessage, { title: "Binnenkort beschikbaar!", description: "Deze functie is op dit moment nog niet beschikbaar, maar mag je vrij snel verwachten. Contacteer ons gerust als je hierover vragen hebt.", closeButton: "Sluiten", type: "clock" }).setDisplayStyle("overlay"))
    }

    changeGroup() {
        this.present(new ComponentWithProperties(CenteredMessage, { title: "Binnenkort beschikbaar!", description: "Deze functie is op dit moment nog niet beschikbaar, maar mag je vrij snel verwachten. Contacteer ons gerust als je hierover vragen hebt.", closeButton: "Sluiten", type: "clock" }).setDisplayStyle("overlay"))
    }
}
</script>
