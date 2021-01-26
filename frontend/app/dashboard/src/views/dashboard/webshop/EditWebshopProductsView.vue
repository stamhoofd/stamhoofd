<template>
    <main class="webshop-view-products">
        <STErrorsDefault :error-box="errorBox" />

        <template v-if="webshop.categories.length > 0">
            <h2>Categorieën</h2>
            <STList>
                <CategoryRow v-for="category in webshop.categories" :key="category.id" :category="category" :webshop="webshop" @patch="$emit('patch', $event)" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)"/>
            </STList>
        </template>

        <template v-else-if="webshop.products.length > 0">
            <h2>Artikels</h2>
            <STList>
                <ProductRow v-for="product in webshop.products" :key="product.id" :product="product" :webshop="webshop" @patch="$emit('patch', $event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)"/>
            </STList>
        </template>
        
        <p>
            <button class="button text" @click="addCategory">
                <span class="icon add"/>
                <span>Categorie toevoegen</span>
            </button>
        </p>

        <p v-if="webshop.categories.length == 0">
            <button class="button text" @click="addProduct">
                <span class="icon add"/>
                <span>Artikel toevoegen</span>
            </button>
        </p>
       
    </main>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STListItem,TooltipDirective as Tooltip, STInputBox, STErrorsDefault, Validator } from "@stamhoofd/components";
import { Category, PrivateWebshop, Product } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditProductView from './products/EditProductView.vue';
import ProductRow from './products/ProductRow.vue';
import EditCategoryView from './categories/EditCategoryView.vue';
import CategoryRow from './categories/CategoryRow.vue';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        ProductRow,
        CategoryRow
    },
    directives: { Tooltip },
})
export default class EditWebshopProductsView extends Mixins(NavigationMixin) {
    @Prop()
    webshop!: PrivateWebshop;

    errorBox: ErrorBox | null = null
    validator = new Validator()

    addProduct() {
        const product = Product.create({})
        const p = PrivateWebshop.patch({})
        p.products.addPut(product)
        this.present(new ComponentWithProperties(EditProductView, { product, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.$emit("patch", p.patch(patch))

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    addCategory() {
        const category = Category.create({})
       
        if (this.webshop.categories.length == 0) {
            // Also inherit all products (only on save)
            category.productIds = this.webshop.products.map(p => p.id)
        }

        const p = PrivateWebshop.patch({})
        p.categories.addPut(category)

        this.present(new ComponentWithProperties(EditCategoryView, { category, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.$emit("patch", p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    moveCategoryUp(category: Category) {
        const index = this.webshop.categories.findIndex(c => category.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = PrivateWebshop.patch({})
        p.categories.addMove(category.id, this.webshop.categories[moveTo]?.id ?? null)
        this.$emit("patch", p)
    }

    moveCategoryDown(category: Category) {
        const index = this.webshop.categories.findIndex(c => category.id === c.id)
        if (index == -1 || index >= this.webshop.categories.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = PrivateWebshop.patch({})
        p.categories.addMove(category.id, this.webshop.categories[moveTo].id)
        this.$emit("patch", p)
    }

    moveProductUp(product: Product) {
        const index = this.webshop.products.findIndex(c => product.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = PrivateWebshop.patch({})
        p.products.addMove(product.id, this.webshop.products[moveTo]?.id ?? null)
        this.$emit("patch", p)
    }

    moveProductDown(product: Product) {
        const index = this.webshop.products.findIndex(c => product.id === c.id)
        if (index == -1 || index >= this.webshop.products.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = PrivateWebshop.patch({})
        p.products.addMove(product.id, this.webshop.products[moveTo].id)
        this.$emit("patch", p)
    }
  
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.webshop-view-products {
    padding-top: 15px;
}
</style>
