<template>
    <STListItem v-long-press="(e) => openMenu(e)" class="right-stack" @contextmenu.prevent="openMenu" @click="openTicket" :selectable="true">
        <h3 class="style-title-list">
            {{ name }}
            <span v-if="ticket.getIndexText()" class="ticket-index">{{ ticket.getIndexText() }}</span>
        </h3>
        <p v-if="isSingle && order" class="style-description-small" v-text="'Bestelling #'+order.number" />
        <p v-if="isSingle && order" class="style-description-small" v-text="order.data.customer.name" />
        <p v-if="!isSingle && !cartItem" class="style-description-small">
            <span class="style-tag error">Verwijderd ticket</span>
        </p>
        <p v-if="cartItem && cartItem.description" class="style-description-small pre-wrap" v-text="cartItem.description" />
        <p v-if="cartItem && cartItem.product.location" class="style-description-small" v-text="cartItem.product.location.name" />
        <p v-if="cartItem && cartItem.product.location && cartItem.product.location.address" class="style-description-small" v-text="cartItem.product.location.address" />
        <p v-if="ticket.getIndexDescriptionString(webshop)" class="style-description-small pre-wrap" v-text="ticket.getIndexDescriptionString(webshop)" />

        <p v-if="scannedAtDescription" class="style-description-small" v-text="scannedAtDescription" />

        <button slot="right" class="button text" type="button" @click="markAs">
            <span :class="'style-tag '+statusColor">{{ statusName }}</span>
            <span v-if="hasWrite" class="icon arrow-down-small" />
        </button>
    </STListItem>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, LongPressDirective, STList, STListItem } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Order, ProductDateRange, TicketPrivate, TicketPublicPrivate, WebshopTicketType } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import TicketAlreadyScannedView from "../tickets/status/TicketAlreadyScannedView.vue";
import ValidTicketView from "../tickets/status/ValidTicketView.vue";
import { WebshopManager } from "../WebshopManager";

@Component({
    components: {
        STListItem,
        STList
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class TicketRow extends Mixins(NavigationMixin){
    @Prop({ required: true })
        ticket!: TicketPublicPrivate

    @Prop({ required: true })
        order!: Order

    @Prop({ required: true })
        webshopManager!: WebshopManager

    get webshop() {
        return this.webshopManager.preview
    }

    QRCodeUrl: string | null = null

    get cartItem() {
        // todo: multiple item support needed!
        return this.ticket.items[0]
    }

    get name() {
        return this.ticket.getTitle()
    }

    get scannedAtDescription() {
        if (!this.ticket.scannedAt) {
            return 'Niet gescand';
        }
        if (!this.ticket.scannedBy) {
            return 'Gescand op '+Formatter.dateTime(this.ticket.scannedAt);
        }
        return "Gescand op "+Formatter.dateTime(this.ticket.scannedAt) + " door " + this.ticket.scannedBy
    }

    get canShare() {
        return !!navigator.share
    }

    get isSingle() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket
    }

    get hasWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        return this.webshop.privateMeta.permissions.hasWriteAccess(p, OrganizationManager.organization.privateMeta?.roles ?? [])
    }

    openTicket() {
         this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(!this.ticket.scannedAt ? ValidTicketView : TicketAlreadyScannedView, {
                        order: this.order,
                        ticket: this.ticket,
                        webshopManager: this.webshopManager
                    })
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    openMenu(clickEvent) {
        const contextMenu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Open scanscherm',
                    action: () => {
                        this.openTicket()
                        return true;
                    },
                    icon: 'qr-code'
                }),
                new ContextMenuItem({
                    name: 'Markeer als',
                    childMenu: this.getMarkAsMenu(),
                }),
                new ContextMenuItem({
                    name: 'Download',
                    action: () => {
                        this.download().catch(console.error)
                        return true;
                    },
                    icon: 'download'
                })
            ]
        ])
        contextMenu.show({clickEvent}).catch(console.error)
    }

    markAs(event) {
        const el = (event.currentTarget as HTMLElement).querySelector(".right") ?? event.currentTarget;
        const contextMenu = this.getMarkAsMenu()
        contextMenu.show({ button: el, xPlacement: "left" }).catch(console.error)
    }

    getMarkAsMenu() {
        return new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Gescand',
                    selected: !!this.ticket.scannedAt,
                    action: () => {
                        this.webshopManager.addTicketPatch(TicketPrivate.patch({
                            id: this.ticket.id,
                            secret: this.ticket.secret, // needed for lookups
                            scannedAt: new Date(),
                            scannedBy: SessionManager.currentSession!.user?.firstName ?? null
                        })).catch(console.error)
                        return true;
                    },
                }),
                new ContextMenuItem({
                    name: 'Niet gescand',
                    selected: !this.ticket.scannedAt,
                    action: () => {
                        this.webshopManager.addTicketPatch(TicketPrivate.patch({
                            id: this.ticket.id,
                            secret: this.ticket.secret, // needed for lookups
                            scannedAt: null,
                            scannedBy: null
                        })).catch(console.error)
                        return true;
                    },
                })
            ]
        ]);
    }

    get statusName() {
        return this.ticket.scannedAt ? "Gescand" : "Niet gescand"
    }

    get statusColor() {
        return this.ticket.scannedAt ? "" : "gray"
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }

    get qrMessage() {
        return "https://"+this.webshop.getUrl(OrganizationManager.organization) + "/tickets/"+this.ticket.secret
    }

    async download() {
        const TicketBuilder = (await import(
            /* webpackChunkName: "TicketBuilder" */
            /* webpackPrefetch: true */
            '@stamhoofd/ticket-builder'
        )).TicketBuilder
 
        const builder = new TicketBuilder([this.ticket], this.webshop, OrganizationManager.organization, this.order ?? undefined)
        await builder.download()
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.ticket-index {
    @extend .style-definition-label;
    display: inline-block;
}
</style>