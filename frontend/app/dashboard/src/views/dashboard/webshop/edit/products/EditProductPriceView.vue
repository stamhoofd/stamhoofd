<template>
    <SaveView :title="isNew ? 'Prijskeuze toevoegen' : 'Prijskeuze bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Prijskeuze toevoegen
        </h1>
        <h1 v-else>
            Prijskeuze bewerken
        </h1>
          
        <STErrorsDefault :error-box="errorBox" />
            
        <ProductPriceBox :product-price="patchedProductPrice" :product="patchedProduct" :error-box="errorBox" @patch="addPatch($event)" />

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze prijskeuze
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, SaveView, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components";
import { Product, ProductPrice, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import ProductPriceBox from "./ProductPriceBox.vue";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        ProductPriceBox
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

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.patchProduct = this.patchProduct.patch(patch)
    }

    save() {
        this.saveHandler(this.patchProduct)
        this.pop({ force: true })
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

    get hasChanges() {
        return patchContainsChanges(this.patchProduct, this.product, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>
