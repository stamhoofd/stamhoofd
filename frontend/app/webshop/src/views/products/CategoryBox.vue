<template>
    <div class="category-box container">
        <h2>{{ category.name }}</h2>

        <ProductGrid :products="products" />
        <hr>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Category, Product, Webshop } from '@stamhoofd/structures';
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
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>