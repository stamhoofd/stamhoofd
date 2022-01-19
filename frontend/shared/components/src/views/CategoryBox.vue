<template>
    <div class="category-box container">
        <h2>{{ category.name }}</h2>
        <p v-if="category.description.length > 0" class="style-description-small" v-text="category.description" />

        <ProductGrid :products="products" :webshop="webshop" :cart="cart" :save-handler="saveHandler" />
        <hr v-if="!isLast">
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Cart, CartItem, Category, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import ProductGrid from "./ProductGrid.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        ProductGrid
    },
    filters: {
        price: Formatter.price
    }
})
export default class CategoryBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
    category: Category

    @Prop({ required: true })
    webshop: Webshop

    @Prop({ default: false })
    isLast: boolean

    @Prop({ required: true })
    cart: Cart

    @Prop({ required: true })
    saveHandler: (newItem: CartItem, oldItem: CartItem | null) => void

    get products() {
        return this.category.productIds.flatMap(id => {
            const product = this.webshop.products.find(p => p.id === id)
            if (product) {
                return [product]
            }
            return []
        })
    }

}
</script>

<style lang="scss">
.category-box > p {
    padding-bottom: 20px;
    white-space: pre-wrap;
}
</style>