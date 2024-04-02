<template>
    <div class="product-grid" :class="{single: products.length === 1}">
        <ProductBox v-for="product in products" :key="product.id" :product="product" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :admin="admin" />
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Cart, CartItem, Checkout, Product, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import ProductBox from "./ProductBox.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        ProductBox
    },
    filters: {
        price: Formatter.price
    }
})
export default class ProductGrid extends Mixins(NavigationMixin){
    @Prop({ default: false })
        admin: boolean

    @Prop({ required: true })
        products: Product[]

    @Prop({ required: true })
        webshop: Webshop
        
    @Prop({ required: true })
        checkout: Checkout

    @Prop({ required: true })
        saveHandler: (newItem: CartItem, oldItem: CartItem | null, component) => void
}
</script>

<style lang="scss">
.product-grid {
    display: grid;
    gap: 0;
    grid-template-columns: 1fr;
}

.enable-grid .product-grid {
    @media (min-width: 801px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;

        &.single {
            grid-template-columns: 1fr;
        }
    }
}
</style>