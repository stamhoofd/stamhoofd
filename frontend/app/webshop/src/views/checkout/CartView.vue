<template>
    <div class="st-view cart-view">
        <STNavigationBar :title="title">
            <span v-if="cart.items.length > 0" slot="left" class="style-tag">{{ cart.price | price }}</span>
            <button slot="right" type="button" class="button icon close gray" @click="pop" />
        </STNavigationBar>
        <main>
            <h1>{{ title }}</h1>

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
                            <template v-if="cartItem.product.allowMultiple">
                                {{ cartItem.amount }} x
                            </template> 
                            {{ cartItem.getUnitPrice(cart) | price }}
                        </p>
                        <div @click.stop>
                            <button class="button icon trash gray" type="button" @click="deleteItem(cartItem)" />
                            <StepperInput v-if="maximumRemainingFor(cartItem) > 1" v-model="cartItem.amount" :min="1" :max="maximumRemainingFor(cartItem)" @input="cartItem.calculateUnitPrice(cart)" @click.native.stop />
                        </div>
                    </footer>

                    <figure v-if="imageSrc(cartItem)" slot="right">
                        <img :src="imageSrc(cartItem)">
                    </figure>
                </STListItem>
            </STList>
        </main>

        <STToolbar v-if="cart.items.length > 0">
            <span slot="left">Totaal: {{ cart.price | price }}</span>
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
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
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
        priceChange: Formatter.priceChange.bind(Formatter)
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

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
    }

    deleteItem(cartItem: CartItem) {
        CheckoutManager.cart.removeItem(cartItem)
        CheckoutManager.saveCart()
    }

    editCartItem(cartItem: CartItem ) {
        this.present(new ComponentWithProperties(CartItemView, { 
            cartItem: cartItem.clone(), 
            oldItem: cartItem,
            cart: CheckoutManager.cart,
            webshop: WebshopManager.webshop,
            saveHandler: (cartItem: CartItem, oldItem: CartItem | null) => {
                cartItem.validate(WebshopManager.webshop, CheckoutManager.cart)
                if (oldItem) {
                    CheckoutManager.cart.removeItem(oldItem)
                }
                new Toast(cartItem.product.name+" is aangepast", "success green").setHide(1000).show()
                CheckoutManager.cart.addItem(cartItem)
                CheckoutManager.saveCart()
            }
        }).setDisplayStyle("sheet"))
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
            width: 70px;
            height: 70px;
            border-radius: $border-radius;

            @media (min-width: 340px) {
                width: 80px;
                height: 80px;
            }

            @media (min-width: 801px) {
                width: 100px;
                height: 100px;
            }
        }
    }
}

</style>