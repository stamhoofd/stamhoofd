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

            <p v-for="code of checkout.discountCodes" :key="code.id" class="discount-box icon gift">
                <span>Kortingscode <span class="style-discount-code">{{code.code}}</span></span>

                <button class="button icon trash" @click="deleteCode(code)" />
            </p>

            <STErrorsDefault :error-box="errorBox" />
           
            <STList>
                <CartItemRow v-for="cartItem of cart.items" :key="cartItem.id" :cartItem="cartItem" :cart="cart" :webshop="webshop" :editable="true" :admin="false" @edit="editCartItem(cartItem)" @delete="deleteItem(cartItem)" @amount="setCartItemAmount(cartItem, $event)" />
            </STList>


            <p>
                <button type="button" class="button text" @click="pop">
                    <span class="icon add" />
                    <span>Nog iets toevoegen</span>
                </button>
            </p>

            <CheckoutPriceBreakdown :checkout="checkout" />
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
import { CartItemView, ErrorBox, LoadingButton, StepperInput, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, CheckoutPriceBreakdown, CartItemRow } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { CartItem, DiscountCode } from '@stamhoofd/structures';
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
        CartItemRow,
        CheckoutPriceBreakdown
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

    deleteCode(code: DiscountCode) {
        CheckoutManager.removeCode(code)
    }

    deleteItem(cartItem: CartItem) {
        CheckoutManager.cart.removeItem(cartItem)
        CheckoutManager.checkout.update(this.webshop);
        CheckoutManager.saveCart()
    }

    setCartItemAmount(cartItem: CartItem, amount: number) {
        cartItem.amount = amount
        CheckoutManager.checkout.update(this.webshop);
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
                        checkout: CheckoutManager.checkout,
                        saveHandler: (cartItem: CartItem, oldItem: CartItem | null, component) => {
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

        this.check().catch(console.error)
    }

    async check() {
        try {
            await WebshopManager.reload()
        } catch (e) {
            // Possible: but don't skip validation
            console.error(e);
        }

         try {
            this.cart.validate(WebshopManager.webshop)
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        CheckoutManager.saveCart()

        try {
            await CheckoutManager.validateCodes()
        }  catch (e) {
            console.error(e);
        }
    }

    activated() {     
        this.errorBox = null   
        this.check().catch(console.error)
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
        const admin = false;
        const remaining = cartItem.getMaximumRemaining(cartItem, this.cart, this.webshop, admin);
        return remaining
    }
}
</script>