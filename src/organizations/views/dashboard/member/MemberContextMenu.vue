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
import { Component, Prop, Mixins } from "vue-property-decorator";
import ContextMenu from "@/shared/components/overlays/ContextMenu.vue";
import ContextMenuItem from "@/shared/components/overlays/ContextMenuItem.vue";
import ContextMenuLine from "@/shared/components/overlays/ContextMenuLine.vue";
import { NavigationMixin } from "@/shared/classes/NavigationMixin";
import { Member } from "@/shared/models/Member";
import { ParentTypeHelper } from "@/shared/models/ParentType";
import { ComponentWithProperties } from "@/shared/classes/ComponentWithProperties";
import MailView from "../mail/MailView.vue";
import SMSView from "../sms/SMSView.vue";

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
    member!: Member;

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
    }

    call(phone) {
        window.location.href = "tel://" + phone.replace(" ", "");
    }

    openMail() {
        const displayedComponent = new ComponentWithProperties(MailView, {
            members: [this.member],
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
