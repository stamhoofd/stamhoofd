<template>
    <ContextMenu v-bind="{ x, y }">
        <ContextMenuItem @click="sms">
            SMS'en
        </ContextMenuItem>
        <ContextMenuItem @click="mail">
            E-mailen
        </ContextMenuItem>
        <ContextMenuLine />
        <ContextMenuItem @click="exportToExcel">
            Exporteer naar Excel
        </ContextMenuItem>
        <ContextMenuLine />
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
import { OrderStatus, PrivateOrder } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../../mail/MailView.vue";
import SMSView from "../../sms/SMSView.vue";
import { WebshopManager } from "../WebshopManager";
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
    webshopManager!: WebshopManager;

    get webshop() {
        return this.webshopManager.preview
    }

    @Prop()
    orders!: PrivateOrder[];

    markAs(event) {
        const displayedComponent = new ComponentWithProperties(OrderStatusContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: this.orders,
            webshopManager: this.webshopManager
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
            new Toast("De bestelling is verwijderd", "success").show()
            await WebshopOrdersEventBus.sendEvent("deleted", this.orders)
        } catch (e) {
            Toast.fromError(e).show()
            return;
        }

    }

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

    async exportToExcel() {
        const d = await import(/* webpackChunkName: "OrdersExcelExport" */ "../../../../classes/OrdersExcelExport");
        const OrdersExcelExport = d.OrdersExcelExport
        OrdersExcelExport.export(this.orders);
    }
}
</script>
