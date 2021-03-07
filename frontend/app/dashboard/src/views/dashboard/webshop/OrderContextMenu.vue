<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="markAs">
            Markeer als...
        </ContextMenuItem>
        <ContextMenuItem @click="deleteOrder">
            <span slot="right" class="icon trash" />
            Verwijderen
        </ContextMenuItem>
    </ContextMenu>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, ContextMenuLine, Spinner, Toast } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Order, OrderStatus, WebshopPreview } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import OrderStatusContextMenu from "./OrderStatusContextMenu.vue";
import { WebshopOrdersEventBus } from "./WebshopOrdersEventBus";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine,
        Spinner
    },
})
export default class OrderContextMenu extends Mixins(NavigationMixin) {
    OrderStatus = OrderStatus
    
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    webshop!: WebshopPreview;

    @Prop()
    orders!: Order[];

    markAs(event) {
        const displayedComponent = new ComponentWithProperties(OrderStatusContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: this.orders,
            webshop: this.webshop
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    async deleteOrder() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze bestelling wilt verwijderen? Je kan dit niet ongedaan maken.", "Verwijderen")) {
            return
        }

        try {
            for (const order of this.orders) {
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: "DELETE",
                    path: "/webshop/"+this.webshop.id+"/orders/"+order.id,
                })
            }
        } catch (e) {
            Toast.fromError(e).show()
            return;
        }

        WebshopOrdersEventBus.sendEvent("deleted", this.orders)
        new Toast("De bestelling is verwijderd", "success").show()
    }
}
</script>
