<template>
    <div class="product-grid">
        <ProductBox v-for="product in products" :key="product.id" :product="product" />
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Category, Product, Webshop } from '@stamhoofd/structures';
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
    @Prop({ required: true })
    products: Product[]
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.product-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;

    @media (max-width: 700px) {
        grid-template-columns: 1fr;
    }
}

</style>