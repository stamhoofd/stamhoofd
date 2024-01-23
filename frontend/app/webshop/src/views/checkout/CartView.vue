<template>
    <div class="st-view cart-view">
        <STNavigationBar :title="title" :dismiss="canDismiss" />
        <main class="flex">
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <p v-if="cart.items.length == 0" class="info-box">
                Jouw winkelmandje is leeg. Ga terug en klik op een product om iets toe te voegen.
            </p>
            <STErrorsDefault :error-box="errorBox" />
           
            <STList>
                <STListItem v-for="cartItem in cart.items" :key="cartItem.id" class="cart-item-row" :selectable="true" @click="editCartItem(cartItem)">
                    <h3>
                        <span>{{ cartItem.product.name }}</span>
                        <span class="icon arrow-right-small gray" />
                    </h3>
                    <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                    <footer>
                        <p class="price">
                            {{ cartItem.getFormattedPriceAmount(cart) }}
                        </p>
                        <div @click.stop>
                            <button class="button icon trash" type="button" @click="deleteItem(cartItem)" />
                            <StepperInput v-if="!cartItem.cartError && cartItem.seats.length == 0 && maximumRemainingFor(cartItem) > 1" :value="cartItem.amount" :min="1" :max="maximumRemainingFor(cartItem)" @input="setCartItemAmount(cartItem, $event)" @click.native.stop />
                        </div>
                    </footer>

                    <p v-if="cartItem.cartError" class="error-box small">
                        {{ cartItem.cartError.getHuman() }}

                        <span class="button text">
                            <span>Corrigeren</span>
                            <span class="icon arrow-right-small" />
                        </span>
                    </p>

                    <figure v-if="imageSrc(cartItem)" slot="right">
                        <img :src="imageSrc(cartItem)" :width="imageResolution(cartItem).width" :height="imageResolution(cartItem).height">
                    </figure>
                </STListItem>
            </STList>


            <p>
                <button type="button" class="button text" @click="pop">
                    <span class="icon add" />
                    <span>Nog iets toevoegen</span>
                </button>
            </p>
            <div v-if="cart.items.length > 0 && (checkout.administrationFee || !webshop.isAllFree)" class="pricing-box">
                <STList>
                    <STListItem v-if="checkout.administrationFee">
                        Subtotaal

                        <template slot="right">
                            {{ cart.price | price }}
                        </template>
                    </STListItem>

                    <STListItem v-if="checkout.administrationFee">
                        Administratiekosten

                        <template slot="right">
                            {{ checkout.administrationFee | price }}
                        </template>
                    </STListItem>

                    <STListItem>
                        Totaal

                        <template slot="right">
                            {{ (cart.price + checkout.administrationFee) | price }}
                        </template> 
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar v-if="cart.items.length > 0">
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="goToCheckout">
                    <span class="icon flag" />
                    <span>Bestellen</span>
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { CartItemView, ErrorBox, LoadingButton, StepperInput, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { CartItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from 'vue-property-decorator';

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import { CheckoutStepsManager } from './CheckoutStepsManager';


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        STErrorsDefault,
        LoadingButton,
        StepperInput
    },
    filters: {
        price: Formatter.price.bind(Formatter),
    }
})
export default class CartView extends Mixins(NavigationMixin){
    CheckoutManager = CheckoutManager

    title = "Winkelmandje"
    loading = false
    errorBox: ErrorBox | null = null

    get cart() {
        return this.CheckoutManager.cart
    }

    get checkout() {
        return this.CheckoutManager.checkout
    }

    get webshop() {
        return WebshopManager.webshop
    }

    async goToCheckout() { 
        if (this.loading) {
            return
        }

        this.loading = true
        this.errorBox = null

        try {
            await CheckoutStepsManager.goNext(undefined, this)
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    formatFreePrice(price: number) {
        if (price === 0) {
            return ''
        }
        return Formatter.price(price)
    }

    imageSrc(cartItem: CartItem) {
        return this.imageResolution(cartItem)?.file?.getPublicPath()
    }

    imageResolution(cartItem: CartItem) {
        return cartItem.product.images[0]?.getResolutionForSize(100, 100)
    }

    deleteItem(cartItem: CartItem) {
        CheckoutManager.cart.removeItem(cartItem)
        CheckoutManager.saveCart()
    }

    setCartItemAmount(cartItem: CartItem, amount: number) {
        cartItem.amount = amount
        cartItem.calculateUnitPrice(this.cart)
        CheckoutManager.saveCart()
    }

    editCartItem(cartItem: CartItem ) {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(CartItemView, { 
                        cartItem: cartItem.clone(), 
                        oldItem: cartItem,
                        cart: CheckoutManager.cart,
                        webshop: WebshopManager.webshop,
                        saveHandler: (cartItem: CartItem, oldItem: CartItem | null, component) => {
                            cartItem.validate(WebshopManager.webshop, CheckoutManager.cart)
                            component?.dismiss({force: true})
                            if (oldItem) {
                                CheckoutManager.cart.removeItem(oldItem)
                            }
                            CheckoutManager.cart.addItem(cartItem)
                            CheckoutManager.saveCart()
                        }
                    })
                })
            ],
            modalDisplayStyle: "sheet"
        })
    }

    mounted() {
        UrlHelper.setUrl("/cart")
        
        try {
            this.cart.validate(WebshopManager.webshop)
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        CheckoutManager.saveCart()
    }

    countFor(cartItem: CartItem) {
        return CheckoutManager.cart.items.reduce((prev, item) => {
            if (item.product.id != cartItem.product.id) {
                return prev
            }
            return prev + item.amount
        }, 0)  - (cartItem.amount ?? 0)
    }

    maximumRemainingStockFor(cartItem: CartItem) {
        if (cartItem.product.remainingStock === null) {
            return null
        }

        return cartItem.product.remainingStock - this.countFor(cartItem)
    }

    maximumRemainingOrderFor(cartItem: CartItem) {
        if (cartItem.product.maxPerOrder === null) {
            return null
        }

        return cartItem.product.maxPerOrder - this.countFor(cartItem)
    }

    maximumRemainingFor(cartItem: CartItem) {
        const maxStock = this.maximumRemainingStockFor(cartItem)
        const maxOrder = this.maximumRemainingOrderFor(cartItem)
        const maxMultiple = cartItem.product.allowMultiple ? null : 1

        const arr = [maxStock, maxOrder, maxMultiple].filter((v) => v !== null) as number[]
        return Math.min(...arr)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-view {
    .cart-item-row {
        h3 {
            padding-top: 5px;
            @extend .style-title-3;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
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
            color: $color-primary;
        }

        footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        img {
            max-width: 70px;
            height: auto;
            border-radius: $border-radius;

            @media (min-width: 340px) {
                max-width: 80px;
            }

            @media (min-width: 801px) {
                max-width: 100px;
            }
        }
    }
}

</style>