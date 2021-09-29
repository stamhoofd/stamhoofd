<template>
    <div class="st-view add-item-view">
        <STNavigationBar :title="'Toevoegen'">
            <template #right>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                Nieuwe producten aan bestelling toevoegen
            </h1>

            <CategoryBox v-for="(category, index) in webshop.categories" :key="category.id" :category="category" :webshop="webshop" :cart="cart" :save-handler="saveHandler" :is-last="index === webshop.categories.length - 1" />
            <ProductGrid v-if="webshop.categories.length == 0" :products="webshop.products" :webshop="webshop" :cart="cart" :save-handler="saveHandler" />
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CategoryBox, ProductGrid, STErrorsDefault,STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Cart, CartItem, Webshop } from '@stamhoofd/structures';
import { Component, Mixins,  Prop } from "vue-property-decorator";


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
    cart: Cart

    @Prop({ required: true })
    saveHandler: (newItem: CartItem, oldItem: CartItem | null) => void
}
</script>