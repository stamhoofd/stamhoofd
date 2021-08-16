<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="markAs(OrderStatus.Created)">
            Nieuw
        </ContextMenuItem>
        <ContextMenuItem @click="markAs(OrderStatus.Prepared)">
            Verwerkt
        </ContextMenuItem>
        <ContextMenuItem @click="markAs(OrderStatus.Completed)">
            Voltooid
        </ContextMenuItem>
        <ContextMenuItem @click="markAs(OrderStatus.Canceled)">
            Geannuleerd
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, ContextMenuLine, Spinner, Toast } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Order, OrderStatus, WebshopPreview } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../../mail/MailView.vue";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine,
        Spinner
    },
})
export default class OrderStatusContextMenu extends Mixins(NavigationMixin) {
    OrderStatus = OrderStatus
    
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    webshop!: WebshopPreview;

    @Prop()
    orders!: Order[];

    async markAs(status: OrderStatus) {
        SessionManager.currentSession!.authenticatedServer.request({
            method: "PATCH",
            path: "/webshop/"+this.webshop.id+"/orders",
            decoder: new ArrayDecoder(Order as Decoder<Order>),
            body: this.orders.map(o => Order.patch({ status, id: o.id }))
        }).then((response) => {
            new Toast("Status gewijzigd", "success").setHide(1000).show()

            if (status == OrderStatus.Canceled) {
                this.openMail("Jouw bestelling werd geannuleerd")
            }

            // Move all data to original order
            for (const order of response.data) {
                const original = this.orders.find(o => o.id === order.id)
                if (original) {
                    original.set(order)
                }
            }
        }).catch((e) => {
            Toast.fromError(e).show()
        })
    }

    openMail(subject = "") {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                otherRecipients: this.orders.flatMap((o) => {
                    if ( o.data.customer.email.length > 0) {
                        return [o.data.customer]
                    }
                    return []
                }),
                defaultSubject: subject
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>
