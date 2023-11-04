<template>
    <div class="st-view detailed-ticket-view">
        <STNavigationBar :title="name" :pop="canPop" :dismiss="canDismiss && allowDismiss" :sticky="false" :large="logo">
            <OrganizationLogo v-if="logo" slot="left" :organization="organization" />
            <button v-if="canShare" slot="right" class="button icon share navigation" type="button" @click="share" />
        </STNavigationBar>
        <main>
            <figure class="qr-box">
                <div>
                    <img v-if="QRCodeUrl" :src="QRCodeUrl" :class="{ scanned: !!ticket.scannedAt}" class="peak-brightness" width="370" height="370">
                    <div class="placeholder" />
                </div>
            </figure>
            <p class="event-name">
                {{ webshop.meta.name }}
            </p>
            <h1>
                {{ name }}
                <span v-if="ticket.getIndexText()" class="ticket-index">{{ ticket.getIndexText() }}</span>
            </h1>
            <p v-if="isSingle && order" class="description" v-text="'Bestelling #'+order.number" />
            <p v-if="isSingle && order" class="description" v-text="order.data.customer.name" />
            <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

            <p v-if="cartItem.product.location" class="description" v-text="cartItem.product.location.name" />
            <p v-if="cartItem.product.location && cartItem.product.location.address" class="description" v-text="cartItem.product.location.address" />

            <p class="description" v-text="formatPrice(price)" />
        </main>

        <STToolbar>
            <button slot="right" class="button primary" type="button" @click="download">
                <span class="icon download" />
                <span>Opslaan</span>
            </button>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { OrganizationLogo,STErrorsDefault, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Order, ProductDateRange, TicketPublic, Webshop, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from 'vue-property-decorator';

import { WebshopManager } from "../../classes/WebshopManager";


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STErrorsDefault,
        OrganizationLogo
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class DetailedTicketView extends Mixins(NavigationMixin){
    @Prop({ default: false })
        logo: boolean

    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        ticket: TicketPublic

    @Prop({ required: false, default: null })
        order: Order | null

    @Prop({ default: true })
        allowDismiss: boolean

    QRCodeUrl: string | null = null

    get cartItem() {
        // TODO: multiple item support needed!
        return this.ticket.items[0]
    }

    get organization() {
        return WebshopManager.organization
    }

    get name() {
        return this.ticket.getTitle()
    }

    get canShare() {
        return !!navigator.share
    }

    get price() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket ? (this.order ? this.order.data.totalPrice : Math.max(0, this.ticket.items.reduce((c, item) => c + (item.price ?? 0), 0))) : (this.cartItem?.unitPrice ?? 0)
    }

    get isSingle() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket
    }

    share() {
        navigator.share({
            title: this.webshop.meta.name+" - "+this.name,
            text: "Bekijk en sla jouw ticket op via deze link.",
            url: this.qrMessage,
        }).catch(e => console.error(e))
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }

    get qrMessage() {
        return "https://"+this.webshop.getUrl(WebshopManager.organization) + "/tickets/"+this.ticket.secret
    }

    mounted() {
        this.generateQRCode().catch(console.error)
    }

    async download() {
        const TicketBuilder = (await import(
            /* webpackChunkName: "TicketBuilder" */
            /* webpackPrefetch: true */
            '@stamhoofd/ticket-builder'
        )).TicketBuilder

        const builder = new TicketBuilder([this.ticket], this.webshop, WebshopManager.organization, this.order ?? undefined)
        await builder.download()
    }

    async generateQRCode() {
        const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default

        // Increase scanning speed on mobile screens by adding more correction levels
        this.QRCodeUrl = await QRCode.toDataURL(this.qrMessage, { 
            margin: 0, 
            width: 370, 
            height: 370,
            dark: "#000000",
            color: "#ffffff",
        })
    }

    shouldNavigateAway() {
        return this.allowDismiss
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.detailed-ticket-view {
    main {
        --st-horizontal-padding: 30px;

        .sheet & {
            // Force extra padding on mobile devices
            --st-horizontal-padding: 40px;
        }

        > .event-name {
            @extend .style-definition-label;
        }

        .ticket-index {
            @extend .style-definition-label;
            display: inline-block;
        }

        > h1 {
            @extend .style-title-1;
        }

        > .description {
            @extend .style-description-small;
            padding-top: 10px;
            text-overflow: ellipsis;
            overflow: hidden;
            display: -webkit-box;
            white-space: pre-wrap;
            line-clamp: 2; /* number of lines to show */
            -webkit-line-clamp: 2; /* number of lines to show */
            -webkit-box-orient: vertical;

            + .description {
                padding-top: 0;
            }
        }

        > .price {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 600;
            padding-top: 10px;
            color: $color-primary;
            display: flex;
            flex-direction: row;

            .style-tag {
                margin-left: auto;
            }
        }
    }

    figure {
        padding-bottom: var(--st-horizontal-padding, 30px);

        > div {
            position: relative;
        }

        body.dark & {
            padding-bottom: 20px;
            margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));

            > div {
                background: white;
                padding: 30px;
                border-radius: $border-radius;
            }
        }

        img, .placeholder {
            width: auto;
            height: auto;
            max-width: 100%;
            //max-height: calc(100vh - 200px);
            //max-height: calc(100dvh - 200px);
        }

        img {
            position: absolute;
        }

        .placeholder {
            width: 100%;
            padding-bottom: 100%;
            padding-bottom: min(370px, 100%);
            max-width: 370px;
        }

        > span {
            display: block;
            color: $color-gray-text;
            font-size: 10px;
            font-weight: bold;
        }
    }
}
</style>