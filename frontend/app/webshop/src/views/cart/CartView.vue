<template>
    <div class="st-view cart-view">
        <STNavigationBar :title="title">
            <button slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>
        <main>
            <h1>{{ title }}</h1>

           
            <STList>
                <STListItem v-for="cartItem in cart.items" :key="cartItem.id" class="right-description">
                    {{ cartItem.product.name }}

                    <template slot="right">
                        {{ cartItem.amount }} x {{ cartItem.unitPrice | price }}
                    </template>
                </STListItem>
            </STList>
        
        </main>

        <STToolbar>
            <button slot="right" class="button primary" @click="goToCheckout">
                <span class="icon flag" />
                <span>Bestellen</span>
            </button>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { STList, STListItem,STNavigationBar, STToolbar } from '@stamhoofd/components';
import { CartItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop } from 'vue-property-decorator';
import { Mixins } from 'vue-property-decorator';

import { CheckoutManager } from '../../classes/CheckoutManager';

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
        
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-view {
    
}

</style>