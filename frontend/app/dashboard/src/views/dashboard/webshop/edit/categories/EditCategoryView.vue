<template>
    <div class="st-view product-edit-view">
        <STNavigationBar :title="isNew ? 'Categorie toevoegen' : name+' bewerken'">
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Categorie toevoegen
            </h1>
            <h1 v-else>
                {{ name || 'Categorie' }} bewerken
            </h1>
          
            <STErrorsDefault :error-box="errorBox" />
            <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam van deze categorie"
                    autocomplete=""
                >
            </STInputBox>

            <hr>
            <h2 v-if="isTickets">
                Tickets
            </h2>
            <h2 v-else>
                Artikels
            </h2>
            <STList>
                <ProductRow v-for="product in products" :key="product.id" :product="product" :webshop="patchedWebshop" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)" />
            </STList>

            <p>
                <button class="button text" @click="addProduct">
                    <span class="icon add" />
                    <span v-if="isTickets">Ticket toevoegen</span>
                    <span v-else>Artikel toevoegen</span>
                </button>
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage,ErrorBox, STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { Category, PrivateWebshop, Product, ProductType, Version, WebshopTicketType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditProductView from '../products/EditProductView.vue';
import ProductRow from "../products/ProductRow.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        ProductRow,
        STList
    },
})
export default class EditCategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    category: Category

    @Prop({ required: true })
    isNew!: boolean

    @Prop({ required: true })
    webshop: PrivateWebshop
    
    patchWebshop: AutoEncoderPatchType<PrivateWebshop> = PrivateWebshop.patch({})

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<PrivateWebshop>) => void);

    get patchedWebshop() {
        return this.webshop.patch(this.patchWebshop)
    }

    get isTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.Tickets
    }

    get patchedCategory() {
        const c = this.patchedWebshop.categories.find(c => c.id == this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    get products() {
        return this.patchedCategory.productIds.flatMap(id => {
            const product = this.patchedWebshop.products.find(p => p.id == id)
            if (product) {
                return [product]
            }
            return []
        })
    }

    get name() {
        return this.patchedCategory.name
    }

    set name(name: string) {
        this.addCategoryPatch(Category.patch({ name }))
    }

    addProduct() {
        const product = Product.create({
            type: this.webshop.meta.ticketType === WebshopTicketType.Tickets ? ProductType.Ticket : ProductType.Product
        })
        const p = PrivateWebshop.patch({})
        p.products.addPut(product)

        const cp = Category.patch({ id: this.category.id })
        cp.productIds.addPut(product.id)
        p.categories.addPatch(cp)
        
        this.present(new ComponentWithProperties(EditProductView, { product, webshop: this.webshop.patch(p), isNew: true, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.addPatch(p.patch(patch))

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    addCategoryPatch(patch: AutoEncoderPatchType<Category>) {
        const p = PrivateWebshop.patch({})
        p.categories.addPatch(Category.patch(Object.assign({}, patch, { id: this.category.id })))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<PrivateWebshop>) {
        this.patchWebshop = this.patchWebshop.patch(patch)

        // Delete all products that do not exist any longer
        const deleteIds = this.patchedCategory.productIds.flatMap(id => {
            const product = this.patchedWebshop.products.find(p => p.id == id)
            if (product) {
                // exists
                return []
            }
            return [id]
        })

        if (deleteIds.length > 0) {
            // clean up
            const cp = Category.patch({ id: this.category.id })
            for (const id of deleteIds) {
                cp.productIds.addDelete(id)
                console.log("Automatically deleted product from this category: "+id)
            }
            this.addCategoryPatch(cp)
        }
    }

    save() {
        this.saveHandler(this.patchWebshop)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen")) {
            return
        }
        const p = PrivateWebshop.patch({})
        p.categories.addDelete(this.category.id)

        for (const id of this.category.productIds) {
            p.products.addDelete(id)
        }
        this.saveHandler(p)
        this.pop({ force: true })
    }

    moveProductUp(product: Product) {
        const index = this.patchedCategory.productIds.findIndex(c => product.id === c)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = Category.patch({})
        p.productIds.addMove(product.id, this.patchedCategory.productIds[moveTo] ?? null)
        this.addCategoryPatch(p)
    }

    moveProductDown(product: Product) {
        const index = this.patchedCategory.productIds.findIndex(c => product.id === c)
        if (index == -1 || index >= this.patchedCategory.productIds.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = Category.patch({})
        p.productIds.addMove(product.id, this.patchedCategory.productIds[moveTo])
        this.addCategoryPatch(p)
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchWebshop, this.webshop, { version: Version })
    }

    async shouldNavigateAway() {
        console.log("should navigate away")
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.product-edit-view {
    

}
</style>
