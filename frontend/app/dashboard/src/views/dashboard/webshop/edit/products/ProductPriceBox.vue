<template>
    <div>
        <STInputBox v-if="!isSingle" title="Naam" error-fields="name" :error-box="errorBox">
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
            <PriceInput v-model="price" placeholder="Gratis" :min="null" />
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <Checkbox slot="left" v-model="useDiscount" />

                <h3 class="style-title-list">
                    Korting vanaf een bepaald aantal stuks
                </h3>
                <p v-if="useDiscount" class="style-description-small" @click.stop.prevent>
                    De prijs met korting wordt op het totale aantal toegepast. Als je keuzemenu's en meerdere prijzen hebt, dan tellen we de aantallen met andere keuzes op om het totaal te bepalen (bv. één grote spaghetti met kaas en één kleine spaghetti zonder kaas → telt als twee spaghetti's). Als je dat niet wilt voeg je beter verschillende producten toe.
                </p>

                <div v-if="useDiscount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="Prijs met korting" error-fields="discountPrice" :error-box="errorBox">
                        <PriceInput v-model="discountPrice" placeholder="Gratis" :min="null" />
                    </STInputBox>

                    <STInputBox title="Vanaf aantal stuks" error-fields="discountAmount" :error-box="errorBox">
                        <NumberInput v-model="discountAmount" placeholder="Gratis" :min="2" :stepper="true" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <Checkbox slot="left" v-model="hidden" />

                <h3 class="style-title-list">
                    Verbergen op webshop
                </h3>
                <p v-if="hidden" class="style-description-small">
                    Deze keuze wordt onzichtbaar op de webshop en is enkel te bestellen door manueel een bestelling in te geven als beheerder.
                </p>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Checkbox, ErrorBox, NumberInput, PriceInput, STInputBox, STList, STListItem } from "@stamhoofd/components";
import { Product, ProductPrice } from "@stamhoofd/structures"
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    components: {
        STInputBox,
        PriceInput,
        Checkbox,
        NumberInput,
        STList,
        STListItem
    },
})
export default class ProductPriceBox extends Vue {
    @Prop({ required: true })
        errorBox: ErrorBox

    @Prop({ required: true })
        productPrice: ProductPrice

    @Prop({ required: true })
        product: Product

    get patchedProduct() {
        return this.product
    }

    get patchedProductPrice() {
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

    get discountAmount() {
        return this.patchedProductPrice.discountAmount
    }

    set discountAmount(discountAmount: number) {
        this.addPricePatch(ProductPrice.patch({ discountAmount }))
    }

    get discountPrice() {
        return this.patchedProductPrice.discountPrice
    }

    set discountPrice(discountPrice: number | null) {
        this.addPricePatch(ProductPrice.patch({ discountPrice }))
    }

    get useDiscount() {
        return this.patchedProductPrice.discountPrice !== null
    }

    set useDiscount(useDiscount: boolean) {
        if (useDiscount === this.useDiscount) {
            return
        }
        if (useDiscount) {
            this.discountPrice = this.price
        } else {
            this.discountPrice = null
        }
    }

    get hidden() {
        return this.patchedProductPrice.hidden
    }

    set hidden(hidden: boolean) {
        this.addPricePatch(ProductPrice.patch({ hidden }))
    }

    addPricePatch(patch: AutoEncoderPatchType<ProductPrice>) {
        const p = Product.patch({})
        p.prices.addPatch(ProductPrice.patch(Object.assign({}, patch, { id: this.productPrice.id })))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.$emit('patch', patch)
    }
   
    get isSingle() {
        return this.patchedProduct.prices.length <= 1
    }
}
</script>