<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ viewTitle }}
        </h1>
        <STErrorsDefault :error-box="errorBox" />

        <template v-if="webshop.categories.length > 0">
            <STList v-model="draggableCategories" :draggable="true">
                <template #item="{item: category}">
                    <CategoryRow :category="category" :webshop="webshop" @patch="addPatch($event)" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)" />
                </template>
            </STList>
        </template>

        <template v-else-if="webshop.products.length > 0">
            <STList v-model="draggableProducts" :draggable="true">
                <template #item="{item: product}">
                    <ProductRow :product="product" :webshop="webshop" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)" />
                </template>
            </STList>
        </template>
                
        <p v-if="webshop.categories.length == 0">
            <button class="button text" type="button" @click="addProduct">
                <span class="icon add" />
                <span v-if="isTickets">Ticket toevoegen</span>
                <span v-else>Artikel toevoegen</span>
            </button>
        </p>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add" />
                <span v-if="webshop.categories.length == 0 && webshop.products.length > 0">Opdelen in categorieën</span>
                <span v-else>Categorie toevoegen</span>
            </button>
        </p>

        <template v-if="webshop.canEnableCart">
            <hr>
            <h2>Winkelmandje</h2>
            <p>
                Met een winkelmandje kunnen bezoekers meerdere artikel combinaties in één keer bestellen. Zet je het uit, dan kunnen bezoekers meteen afrekenen na het selecteren van een artikel. Voor formulieren waar je maar één ingevuld formulier (= artikel) verwacht, is het vaak nuttig om het uit te zetten.
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Checkbox v-model="cartEnabled" />
                    </template>
                    <h3 class="style-title-list">
                        Winkelmandje gebruiken
                    </h3>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { Checkbox, SaveView, STErrorsDefault, STList, STListItem } from "@stamhoofd/components";
import { Category, PrivateWebshop, Product, ProductType, WebshopMetaData, WebshopTicketType } from '@stamhoofd/structures';

import CategoryRow from './categories/CategoryRow.vue';
import EditCategoryView from './categories/EditCategoryView.vue';
import EditWebshopMixin from "./EditWebshopMixin";
import EditProductView from './products/EditProductView.vue';
import ProductRow from './products/ProductRow.vue';

@Component({
    components: {
        STListItem,
        STList,
        STErrorsDefault,
        ProductRow,
        CategoryRow,
        SaveView,
        Checkbox
    }
})
export default class EditWebshopProductsView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        if (this.isTickets) {
            if (this.webshop.categories.length > 0) {
                return "Ticket categorieën"
            }
            return "Aanbod tickets en vouchers"
        }
        if (this.webshop.categories.length > 0) {
            return "Product categorieën"
        }
        return "Productaanbod"
    }

    get isTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.Tickets
    }

    get cartEnabled() {
        return this.webshop.meta.cartEnabled
    }

    set cartEnabled(cartEnabled: boolean) {
        const patch = WebshopMetaData.patch({ cartEnabled })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
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

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
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

    get draggableProducts() {
        return this.webshop.products;
    }

    set draggableProducts(products) {
        if (products.length != this.webshop.products.length) {
            return;
        }

        const patch = PrivateWebshop.patch({})
        for (const p of products.slice().reverse()) {
            patch.products.addMove(p.id, null)
        }
        this.addPatch(patch)
    }

    get draggableCategories() {
        return this.webshop.categories;
    }

    set draggableCategories(categories) {
        if (categories.length != this.webshop.categories.length) {
            return;
        }

        const patch = PrivateWebshop.patch({})
        for (const c of categories.slice().reverse()) {
            patch.categories.addMove(c.id, null)
        }
        this.addPatch(patch)
    }
}
</script>
