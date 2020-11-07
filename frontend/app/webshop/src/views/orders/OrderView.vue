<template>
    <LoadingView v-if="!order" />
    <div class="boxed-view" v-else>
        <div class="st-view order-view">
            <main>
                <h1>Jouw bestelling {{ order.id }}</h1>

                <p>{{ order.validAt || "Not valid" }}</p>

                <STList>
                    <STListItem>
                        Afhaaldatum

                        <template slot="right">{{ order.data.timeSlot.date | date }}</template>
                    </STListItem>
                </STList>

                <hr>
                <h2>Jouw bestelling</h2>

                <STList>
                    <STListItem v-for="cartItem in order.data.cart.items" :key="cartItem.id" class="cart-item-row">
                        <h3>
                            {{ cartItem.product.name }}
                        </h3>
                        <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                        <footer>
                            <p class="price">
                                {{ cartItem.amount }} x {{ cartItem.unitPrice | price }}
                            </p>
                        </footer>

                        <figure v-if="imageSrc(cartItem)" slot="right">
                            <img :src="imageSrc(cartItem)">
                        </figure>
                    </STListItem>
                </STList>
                
            </main>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar, LoadingView, PaymentHandler, CenteredMessage } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { CartItem, Group, KeychainedResponse, MemberWithRegistrations, Order, OrderData, OrderResponse, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, WebshopTakeoutMethod, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import MemberGeneralView from '../registration/MemberGeneralView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        LoadingView
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter)
    }
})
export default class OrderView extends Mixins(NavigationMixin){
    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    @Prop({ default: null })
    orderId: string | null

    @Prop({ default: null })
    paymentId: string | null

    order: Order | null = null

    mounted() {
        // Load order
        if (this.orderId) {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/order/"+this.orderId)

             WebshopManager.server
                .request({
                    method: "GET",
                    path: "/webshop/" +WebshopManager.webshop.id + "/order/"+this.orderId,
                    decoder: Order as Decoder<Order>,
                }).then(response => {
                    const order = response.data
                    this.order = order
                }).catch(e => {
                    // too: handle this
                    console.error(e)
                    new CenteredMessage("Ongeldige bestelling", "De bestelling die je opvraagt bestaat niet (meer)", "error").addCloseButton().show()
                    this.pop({ force: true })
                })
        } else {
            if (!this.paymentId) {
                throw new Error("Missing payment id or order id")
            }
            WebshopManager.server
                .request({
                    method: "GET",
                    path: "/webshop/" +WebshopManager.webshop.id + "/payment/"+this.paymentId+"/order",
                    decoder: Order as Decoder<Order>,
                }).then(response => {
                    const order = response.data
                    this.order = order
                    HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/order/"+this.order.id)
                }).catch(e => {
                    // too: handle this
                    console.error(e)
                    new CenteredMessage("Ongeldige bestelling", "De bestelling die je opvraagt bestaat niet (meer)", "error").addCloseButton().show()
                    this.pop({ force: true })
                })
        }
    }

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.order-view {
    .cart-item-row {
        h3 {
            padding-top: 5px;
            @extend .style-title-3;
        }

        .description {
            @extend .style-description-small;
            padding-top: 5px;
            white-space: pre-wrap;
        }

        .price {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 600;
            padding-top: 10px;
            color: $color-primary;
        }

        footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        img {
            width: 100px;
            height: 100px;
            border-radius: $border-radius;
        }
    }
}
</style>