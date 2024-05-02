<template>
    <div class="st-view add-item-view">
        <STNavigationBar title="Producten" />
        <main>
            <h1>
                Producten
            </h1>

            <CategoryBox v-for="(category, index) in webshop.categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :is-last="index === webshop.categories.length - 1" :admin="true" />
            <ProductGrid v-if="webshop.categories.length == 0" :products="webshop.products" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :admin="true" />
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CategoryBox, ProductGrid, STErrorsDefault, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Cart, CartItem, Checkout, Webshop } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STErrorsDefault,
        CategoryBox,
        ProductGrid
    }
})
export default class AddItemView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        checkout: Checkout

    @Prop({ required: true })
        saveHandler: (newItem: CartItem, oldItem: CartItem | null, component) => void
}
</script>