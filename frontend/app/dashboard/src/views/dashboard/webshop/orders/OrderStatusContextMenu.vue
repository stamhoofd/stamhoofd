<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="markAs(OrderStatus.Created)">
            Nieuw
        </ContextMenuItem>
        <ContextMenuItem @click="markAs(OrderStatus.Prepared)">
            Verwerkt
        </ContextMenuItem>
        <ContextMenuItem @click="markAs(OrderStatus.Collect)">
            Ligt klaar
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
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, ContextMenuLine, Spinner, Toast } from "@stamhoofd/components";
import { OrderStatus, PrivateOrder } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../../mail/MailView.vue";
import { WebshopManager } from "../WebshopManager";

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
    webshopManager!: WebshopManager;

    get webshop() {
        return this.webshopManager.preview
    }

    @Prop()
    orders!: PrivateOrder[];

    markAs(status: OrderStatus) {
        this.webshopManager.patchOrders(
            this.orders.map(o => PrivateOrder.patch({ status, id: o.id }))
        ).then((orders) => {
            new Toast("Status gewijzigd", "success").setHide(1000).show()

            // Move all data to original order
            for (const order of orders) {
                const original = this.orders.find(o => o.id === order.id)
                if (original) {
                    original.set(order)
                }
            }

            if (status == OrderStatus.Canceled) {
                new Toast("Je moet zelf communiceren dat de bestelling werd geannuleerd", "warning yellow").setHide(10*1000).show()
            }
        }).catch((e) => {
            Toast.fromError(e).show()
        })
    }
}
</script>
