<template>
    <div class="st-view webshop-view-products">
        <STNavigationBar :title="title">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>{{ title }}</h1>
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="webshop.categories.length > 0">
                <h2>Categorieën</h2>
                <STList>
                    <CategoryRow v-for="category in webshop.categories" :key="category.id" :category="category" :webshop="webshop" @patch="addPatch($event)" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)" />
                </STList>
            </template>

            <template v-else-if="webshop.products.length > 0">
                <template v-if="webshop.categories.length > 0">
                    <h2 v-if="isTickets">
                        Tickets
                    </h2>
                    <h2 v-else>
                        Artikels
                    </h2>
                </template>
                <STList>
                    <ProductRow v-for="product in webshop.products" :key="product.id" :product="product" :webshop="webshop" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)" />
                </STList>
            </template>
                
            <p v-if="webshop.categories.length == 0">
                <button class="button text" @click="addProduct">
                    <span class="icon add" />
                    <span v-if="isTickets">Ticket toevoegen</span>
                    <span v-else>Artikel toevoegen</span>
                </button>
            </p>

            <p>
                <button class="button text" @click="addCategory">
                    <span class="icon add" />
                    <span v-if="webshop.categories.length == 0 && webshop.products.length > 0">Opdelen in categorieën</span>
                    <span v-else>Categorie toevoegen</span>
                </button>
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { Category, PrivateWebshop, Product, ProductType, WebshopTicketType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import CategoryRow from './categories/CategoryRow.vue';
import EditCategoryView from './categories/EditCategoryView.vue';
import EditWebshopMixin from "./EditWebshopMixin";
import EditProductView from './products/EditProductView.vue';
import ProductRow from './products/ProductRow.vue';


@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        ProductRow,
        CategoryRow,
        STNavigationBar,
        LoadingButton,
        STToolbar,
        BackButton
    },
    directives: { Tooltip },
})
export default class EditWebshopProductsView extends Mixins(EditWebshopMixin) {
    get title() {
        if (this.isTickets) {
            return "Wijzig tickets en vouchers"
        }
        return "Wijzig verkochte artikels"
    }

    get isTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.Tickets
    }

    addProduct() {
        const product = Product.create({
            type: this.webshop.meta.ticketType === WebshopTicketType.Tickets ? ProductType.Ticket : ProductType.Product
        })
        const p = PrivateWebshop.patch({})
        p.products.addPut(product)
        this.present(new ComponentWithProperties(EditProductView, { product, webshop: this.webshop.patch(p), isNew: true, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.addPatch(p.patch(patch))

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

        this.present(new ComponentWithProperties(EditCategoryView, { category, webshop: this.webshop.patch(p), isNew: true, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.addPatch(p.patch(patch))
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
        this.addPatch(p)
    }

    moveCategoryDown(category: Category) {
        const index = this.webshop.categories.findIndex(c => category.id === c.id)
        if (index == -1 || index >= this.webshop.categories.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = PrivateWebshop.patch({})
        p.categories.addMove(category.id, this.webshop.categories[moveTo].id)
        this.addPatch(p)
    }

    moveProductUp(product: Product) {
        const index = this.webshop.products.findIndex(c => product.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = PrivateWebshop.patch({})
        p.products.addMove(product.id, this.webshop.products[moveTo]?.id ?? null)
        this.addPatch(p)
    }

    moveProductDown(product: Product) {
        const index = this.webshop.products.findIndex(c => product.id === c.id)
        if (index == -1 || index >= this.webshop.products.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = PrivateWebshop.patch({})
        p.products.addMove(product.id, this.webshop.products[moveTo].id)
        this.addPatch(p)
    }
  
}
</script>
