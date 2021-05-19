<template>
    <div class="st-view product-price-edit-view">
        <STNavigationBar :title="isNew ? 'Prijskeuze toevoegen' : name+' bewerken'">
            <template slot="right">
                <button v-if="!isNew && !isSingle" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Prijskeuze toevoegen
            </h1>
            <h1 v-else>
                {{ name }} bewerken
            </h1>
          
            <STErrorsDefault :error-box="errorBox" />
            <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam van deze keuze"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Prijs" error-fields="price" :error-box="errorBox">
                <PriceInput v-model="price" placeholder="Gratis" />
            </STInputBox>
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
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, PriceInput,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Category, Group, GroupGenderType, GroupPatch, GroupPrices, GroupSettings, GroupSettingsPatch, Organization, PrivateWebshop, Product, ProductPrice, Version, WaitingListType, Webshop } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        STList
    },
})
export default class EditProductPriceView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    productPrice: ProductPrice

    @Prop({ required: true })
    isNew!: boolean

    @Prop({ required: true })
    product: Product
    
    patchProduct: AutoEncoderPatchType<Product> = Product.patch({})

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<Product>) => void);

    get patchedProduct() {
        return this.product.patch(this.patchProduct)
    }

    get patchedProductPrice() {
        const c = this.patchedProduct.prices.find(c => c.id == this.productPrice.id)
        if (c) {
            return c
        }
        return this.productPrice
    }

    get name() {
        return this.patchedProductPrice.name
    }

    set name(name: string) {
        this.addPricePatch(ProductPrice.patch({ name }))
    }

    get price() {
        return this.patchedProductPrice.price
    }

    set price(price: number) {
        this.addPricePatch(ProductPrice.patch({ price }))
    }

    addPricePatch(patch: AutoEncoderPatchType<ProductPrice>) {
        const p = Product.patch({})
        p.prices.addPatch(ProductPrice.patch(Object.assign({}, patch, { id: this.productPrice.id })))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.patchProduct = this.patchProduct.patch(patch)
    }

    save() {
        this.saveHandler(this.patchProduct)
        this.pop({ force: true })
    }

    get isSingle() {
        return this.patchedProduct.prices.length <= 1
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze prijskeuze wilt verwijderen?", "Verwijderen")) {
            return
        }
        const p = Product.patch({})
        p.prices.addDelete(this.productPrice.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchProduct, this.product, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
