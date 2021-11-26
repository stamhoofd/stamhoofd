<template>
    <div class="ticket-container">
        <article class="ticket-box">
            <svg width="100%" height="100%" class="maskingSvg">
                <defs>
                    <mask :id="'TicketBoxMask-'+ticket.id">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" rx="5px" />
                        <circle cx="0" cy="50%" r="15px" fill="black" class="circle-location" />
                    </mask>
                </defs>

                <rect x="0" y="0" width="100%" height="100%" fill="white" :mask="'url(#TicketBoxMask-'+ticket.id+')'" class="svg-background" />
            </svg>

            <div class="content">
                <div>
                    <p class="event-name">
                        {{ webshop.meta.name }}
                    </p>
                    <h3>
                        {{ name }}
                        <span v-if="ticket.getIndexText()" class="ticket-index">{{ ticket.getIndexText() }}</span>
                    </h3>
                    <p v-if="isSingle && order" class="description" v-text="'Bestelling #'+order.number" />
                    <p v-if="isSingle && order" class="description" v-text="order.data.customer.name" />
                    <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                    <p v-if="cartItem.product.location" class="description" v-text="cartItem.product.location.name" />
                    <p v-if="cartItem.product.location" class="description" v-text="cartItem.product.location.address" />

                    <p class="description" v-text="formatPrice(price)" />
                </div>
            </div>
            <figure>
                <img v-if="QRCodeUrl" :src="QRCodeUrl" :class="{ scanned: !!ticket.scannedAt}" class="peak-brightness">
                <div v-else class="placeholder" />
                <span>{{ ticket.secret }}</span>
            </figure>
        </article>
        <div class="ticket-buttons">
            <button class="button text" @click="download">
                <span class="icon download" />
                <span>Download dit ticket</span>
            </button>

            <button v-if="canShare" class="button text" @click="share">
                <span class="icon share" />
                <span>Delen</span>
            </button>
        </div>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Order, ProductDateRange, TicketPublic, Webshop, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { WebshopManager } from "../../classes/WebshopManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    }
})
export default class TicketBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
    webshop: Webshop

    @Prop({ required: true })
    ticket: TicketPublic

    @Prop({ required: false, default: null })
    order: Order | null

    QRCodeUrl: string | null = null

    get cartItem() {
        // todo: multiple item support needed!
        return this.ticket.items[0]
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
            '../../classes/TicketBuilder'
        )).TicketBuilder

        const builder = new TicketBuilder([this.ticket], this.webshop, WebshopManager.organization, this.order ?? undefined)
        await builder.download()
    }

    async generateQRCode() {
        const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default

        // Increase scanning speed on mobile screens by adding more correction levels
        this.QRCodeUrl = await QRCode.toDataURL(this.qrMessage, { errorCorrectionLevel: "H" })
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.ticket-container {
    padding: 15px 0;
}

.ticket-buttons {
    padding-top: 10px;

    .button {
        margin-right: 15px;

        &:last-child {
            margin-right: 0;
        }
    }
}
.ticket-box {
    display: flex;
    flex-direction: row;
    align-items: center;
    position: relative;
    z-index: 0;
    
    .maskingSvg {
        display: block;
        z-index: -1;
        position: absolute;

        @media (max-width: 700px) {
            .circle-location {
                cx: 50%;
                cy: 0;
            }
        }
    }

    @media (max-width: 700px) {
        flex-direction: column;
    }

    filter: drop-shadow($color-side-view-shadow 0px 2px 5px);
    margin: 0;

   

    > .content {
        flex-grow: 1;
        min-width: 0;
        align-self: stretch;
        display: flex;
        align-items: center;
        position: relative;

        > div {
            padding: 30px;
            flex-grow: 1;
            min-width: 0;

            @media (max-width: 700px) {
                padding: 30px 20px 20px 20px;
            }

            > .event-name {
                @extend .style-definition-label;
            }

            .ticket-index {
                @extend .style-definition-label;
                display: inline-block;
            }

            > h3 {
                padding-top: 5px;
                @extend .style-title-2;
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
    }


    > figure {
        flex-shrink: 0;
        padding: 30px;
        text-align: center;

        border-left: 2px solid $color-border-lighter;

        @media (max-width: 700px) {
            align-self: stretch;
            border-left: 0;
            padding: 20px;
            border-top: 2px solid $color-border-lighter;
        }

        > img, .placeholder {
            width: 160px;
            height: 160px;

            @media (max-width: 700px) {
                width: 70vw;
                height: 70vw;
            }

            &.scanned {
                opacity: 0.3;
            }
        }

        > span {
            display: block;
            color: $color-gray;
            font-size: 10px;
            font-weight: bold;
        }
    }
}
</style>