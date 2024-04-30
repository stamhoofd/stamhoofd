<template>
    <STListItem class="ticket-list-item right-stack" :selectable="true" @click="openTicket">
        <h3>
            {{ name }}
            <span v-if="ticket.getIndexText()" class="ticket-index">{{ ticket.getIndexText() }}</span>
        </h3>
        <p v-if="isSingle && order" class="description" v-text="'Bestelling #'+order.number" />
        <p v-if="isSingle && order" class="description" v-text="order.data.customer.name" />
        <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

        <p v-if="cartItem.product.location" class="description" v-text="cartItem.product.location.name" />
        <p v-if="cartItem.product.location && cartItem.product.location.address" class="description" v-text="cartItem.product.location.address" />
        <p v-if="ticket.getIndexDescriptionString(webshop)" class="description" v-text="ticket.getIndexDescriptionString(webshop)" />

        <template #right><span class="icon qr-code" />
        <span class="icon arrow-right-small gray" /></template>
    </STListItem>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, DetailedTicketView,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Order, Organization, ProductDateRange, TicketPublic, Webshop, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

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
export default class TicketListItem extends Mixins(NavigationMixin){
    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        organization: Organization

    @Prop({ required: true })
        ticket: TicketPublic

    @Prop({ required: false, default: null })
        order: Order | null

    QRCodeUrl: string | null = null

    get cartItem() {
        // TODO: multiple item support needed!
        return this.ticket.items[0]
    }

    get name() {
        return this.ticket.getTitle()
    }

    get canShare() {
        return !!navigator.share
    }

    get isSingle() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket
    }

    openTicket() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(DetailedTicketView, {
                        ticket: this.ticket,
                        order: this.order,
                        webshop: this.webshop,
                        organization: this.organization
                    })
                })
            ],
            modalDisplayStyle: "sheet"
        })
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


.ticket-list-item {

    .middle {
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
            line-clamp: 3; /* number of lines to show */
            -webkit-line-clamp: 3; /* number of lines to show */
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
</style>