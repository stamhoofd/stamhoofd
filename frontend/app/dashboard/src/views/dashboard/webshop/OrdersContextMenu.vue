<template>
    <ContextMenu v-bind="{ x, y }">
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
import { Group, MemberWithRegistrations, Order } from '@stamhoofd/structures';
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
export default class OrdersContextMenu extends Mixins(NavigationMixin) {
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    orders!: Order[];

    sms() {
        const displayedComponent = new ComponentWithProperties(SMSView, {
            customers: this.orders.map(o => o.data.customer),
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
    mail() {
        const displayedComponent = new ComponentWithProperties(MailView, {
            otherRecipients: this.orders.flatMap((o) => {
                if ( o.data.customer.email.length > 0) {
                    return [o.data.customer]
                }
                return []
            }),
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>
