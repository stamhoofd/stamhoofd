<template>
    <div class="st-view cart-view">
        <STNavigationBar :title="title">
            <span slot="left" class="style-tag">{{ cart.price | price }}</span>
            <button slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>
        <main>
            <h1>{{ title }}</h1>

           
            <STList>
                <STListItem v-for="cartItem in cart.items" :key="cartItem.id" class="cart-item-row" :selectable="true" @click="editCartItem(cartItem)">
                    <h3>
                        <span>{{ cartItem.product.name }}</span>
                        <span class="icon arrow-right-small gray" />
                    </h3>
                    <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                    <footer>
                        <p class="price">
                            {{ cartItem.amount }} x {{ cartItem.unitPrice | price }}
                        </p>
                        <div>
                            <button class="button icon trash gray" @click="deleteItem(cartItem)" />
                        </div>
                    </footer>

                    <figure v-if="imageSrc(cartItem)" slot="right">
                        <img :src="imageSrc(cartItem)">
                    </figure>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <span slot="left">Totaal: {{ cart.price | price }}</span>
            <button slot="right" class="button primary" @click="goToCheckout">
                <span class="icon flag" />
                <span>Bestellen</span>
            </button>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { STList, STListItem,STNavigationBar, STToolbar } from '@stamhoofd/components';
import { CartItem, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop } from 'vue-property-decorator';
import { Mixins } from 'vue-property-decorator';

import { CheckoutManager } from '../../classes/CheckoutManager';
import CheckoutMethodSelectionView from '../checkout/CheckoutMethodSelectionView.vue';
import CartItemView from '../products/CartItemView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class CartView extends Mixins(NavigationMixin){
    CheckoutMaanger = CheckoutManager

    title = "Winkelmandje"

    get cart() {
        return this.CheckoutMaanger.cart
    }

    goToCheckout() { 
        const nav = this.modalStackComponent!.$refs.navigationController! as NavigationController;
        console.log(nav.components[nav.components.length - 1]);
        console.log((nav.components[nav.components.length - 1] as any).componentInstance());
        (nav.components[nav.components.length - 1] as any).componentInstance().$refs.steps.navigationController.push(new ComponentWithProperties(CheckoutMethodSelectionView, {}))
        this.dismiss({ force: true })
    }

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
    }

    deleteItem(cartItem: CartItem) {
        CheckoutManager.cart.removeItem(cartItem)
        CheckoutManager.saveCart()
    }

    editCartItem(cartItem: CartItem ) {
        this.present(new ComponentWithProperties(CartItemView, { cartItem: cartItem.duplicate(Version), oldItem: cartItem }).setDisplayStyle("sheet"))
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