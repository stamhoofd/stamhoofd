<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem>Groep wijzigen</ContextMenuItem>
        <ContextMenuLine />
        <ContextMenuItem v-for="(parent, index) in member.parents" :key="index" @click="call(parent.phone)">
            {{ parent.firstName }} ({{ ParentTypeHelper.getName(parent.type) }}) bellen
        </ContextMenuItem>
        <ContextMenuItem @click="openSMS('parents')">
            Ouders SMS'en
        </ContextMenuItem>
        <ContextMenuItem @click="openMail">
            Ouders mailen
        </ContextMenuItem>

        <template v-if="member.phone">
            <ContextMenuLine />
            <ContextMenuItem @click="call(member.phone)">
                {{ member.firstName }} bellen
            </ContextMenuItem>
            <ContextMenuItem @click="openSMS('members')">
                {{ member.firstName }} SMS'en
            </ContextMenuItem>
        </template>

        <ContextMenuLine />
        <ContextMenuItem>Uitschrijven</ContextMenuItem>
        <ContextMenuItem>Data verwijderen</ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ParentTypeHelper } from "@stamhoofd-frontend/models";
import { ContextMenu } from "@stamhoofd/components";
import { ContextMenuItem } from "@stamhoofd/components";
import { ContextMenuLine } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../mail/MailView.vue";
import SMSView from "../sms/SMSView.vue";
import { MemberWithRegistrations } from '@stamhoofd/structures';

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
            smsFilter: smsFilter,
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>
