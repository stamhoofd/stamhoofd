<template>
    <SaveView :title="isNew ? 'Productkorting toevoegen' : 'Productkorting bewerken'" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            Productkorting toevoegen
        </h1>
        <h1 v-else>
            Productkorting bewerken
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <ProductSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="validator" @patch="patchProductSelector" />

        <hr>
        <h2>Korting</h2>
        <p v-if="discounts.length > 1">
            De kortingen worden toegepast van hoog naar lage prijs. Dus het eerste stuk is het artikel met de hoogste prijs (als er prijs verschillen zijn binnenin hetzelfde artikel door bijvoorbeeld keuzemenu's). Als de korting per stuk groter is dan de prijs van een stuk, is het stuk gratis en wordt de korting niet overgedragen.
        </p>

        <div v-for="(d, index) in discounts" :key="d.id">
            <STInputBox :title="discounts.length === 1 ? 'Korting' : 'Korting op '+(index+1)+'e stuk' + ((repeatBehaviour === 'RepeatLast' && index === discounts.length - 1) ? ' en verder' : '')" :error-box="errorBox" class="max">
                <template v-if="discounts.length > 1" #right><button class="button icon trash gray" type="button" @click="removeDiscount(d)" /></template>

                <div class="split-inputs">
                    <div>
                        <PriceInput v-if="getDiscountType(d) == 'discountPerPiece'" :value="getDiscountDiscountPerPiece(d)" :min="0" :required="true" @input="setDiscountDiscountPerPiece(d, $event)" />
                        <PermyriadInput v-else :value="getDiscountPercentageDiscount(d)" :required="true" @input="setDiscountPercentageDiscount(d, $event)" />
                    </div>
                    <div>
                        <Dropdown :value="getDiscountType(d)" @change="setDiscountType(d, $event)">
                            <option value="percentageDiscount">
                                Percentage
                            </option>
                            <option value="discountPerPiece">
                                Bedrag
                            </option>
                        </Dropdown>
                    </div>
                </div>
            </STInputBox>
        </div>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add" />
                <span v-if="discounts.length === 1">Andere korting op tweede stuk</span>
                <span v-else>Toevoegen</span>
            </button>
        </p>

        <!--<STInputBox title="Kortingpercentage" error-fields="percentageDiscount" :error-box="errorBox" class="max">
            <PermyriadInput
                v-model="percentageDiscount"
                :required="true"
            />
        </STInputBox>-->

        <hr>
        <h2>Herhalen</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <Radio #left v-model="repeatBehaviour" value="Once" />
                <h3 class="style-title-list">
                    Niet herhalen
                </h3>
                <p class="style-description">
                    De korting wordt maar één keer toegepast.
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <Radio #left v-model="repeatBehaviour" value="RepeatLast" />
                <h3 v-if="discounts.length > 1 || repeatBehaviour == 'RepeatPattern'" class="style-title-list">
                    Laatste korting herhalen
                </h3>
                <h3 v-else>
                    Herhalen
                </h3>
                <p class="style-description">
                    De laatste korting uit de lijst wordt toegepast als er nog meer stuks zijn.
                </p>
            </STListItem>

            <STListItem v-if="discounts.length > 1 || repeatBehaviour == 'RepeatPattern'" :selectable="true" element-name="label" class="left-center">
                <Radio #left v-model="repeatBehaviour" value="RepeatPattern" />
                <h3 class="style-title-list">
                    Patroon herhalen
                </h3>
                <p class="style-description">
                    Als er meer stuks zijn wordt de eerste korting terug toegepast, daarna de tweede...
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2>Zichtbaarheid (optioneel)</h2>
        <p>Als deze korting wordt toegepast op een item in een winkelmandje kan je bij dat item een label tonen (bv. 'BLACK FRIDAY'). Hou dit label kort, bij voorkeur 1 woord.</p>

        <STInputBox title="Label" error-fields="cartLabel" :error-box="errorBox">
            <input
                v-model="cartLabel"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete=""
            >
        </STInputBox>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze korting
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, NumberInput, PermyriadInput, PriceInput, Radio,SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { PrivateWebshop, ProductDiscount, ProductDiscountRepeatBehaviour,ProductDiscountSettings, ProductSelector, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";


import ProductSelectorBox from './ProductSelectorBox.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        NumberInput,
        STList,
        STListItem,
        PermyriadInput,
        PriceInput,
        Checkbox,
        ProductSelectorBox,
        Dropdown,
        Radio
    },
})
export default class EditProductDiscountView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        productDiscount!: ProductDiscountSettings

    @Prop({ required: true })
        isNew!: boolean

    @Prop({ required: true })
        webshop: PrivateWebshop

    /// For now only used to update locations and times of other products that are shared
    patchProductDiscount: AutoEncoderPatchType<ProductDiscountSettings> = ProductDiscountSettings.patch({ id: this.productDiscount.id })
    cachedDiscountType: Map<string, 'percentageDiscount' | 'discountPerPiece'> = new Map()

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patch: PatchableArrayAutoEncoder<ProductDiscountSettings>) => void;
    
    get patchedProductDiscount() {
        return this.productDiscount.patch(this.patchProductDiscount)
    }

    get organization() {
        return this.$organization
    }

    get productSelector() {
        return this.patchedProductDiscount.product
    }

    patchProductSelector(patch: AutoEncoderPatchType<ProductSelector>) {
        this.addPatch(ProductDiscountSettings.patch({
            product: patch
        }))
    }

    addPatch(patch: AutoEncoderPatchType<ProductDiscountSettings>) {
        this.patchProductDiscount = this.patchProductDiscount.patch(patch)
    }

    get discounts() {
        return this.patchedProductDiscount.discounts
    }
    
    get repeatBehaviour() {
        return this.patchedProductDiscount.repeatBehaviour
    }

    set repeatBehaviour(repeatBehaviour: ProductDiscountRepeatBehaviour) {
        this.addPatch(ProductDiscountSettings.patch({
            repeatBehaviour
        }))
    }

    get cartLabel() {
        return this.patchedProductDiscount.cartLabel ?? ''
    }

    set cartLabel(cartLabel: string) {
        this.addPatch(ProductDiscountSettings.patch({
            cartLabel: cartLabel || null
        }))
    }

    getDiscountType(d: ProductDiscount) {
        if (this.cachedDiscountType.has(d.id)) {
            return this.cachedDiscountType.get(d.id)
        }

        if (d.discountPerPiece > 0) {
            return 'discountPerPiece'
        }
        return 'percentageDiscount'
    }

    setDiscountType(d: ProductDiscount, type: 'percentageDiscount' | 'discountPerPiece') {
        this.cachedDiscountType.set(d.id, type)

        const p = ProductDiscountSettings.patch({})
        if (type === 'percentageDiscount') {
            p.discounts.addPatch(ProductDiscount.patch({
                id: d.id,
                percentageDiscount: Math.min(100, this.getDiscountDiscountPerPiece(d)),
                discountPerPiece: 0
            }))
        } else {
            p.discounts.addPatch(ProductDiscount.patch({
                id: d.id,
                percentageDiscount: 0,
                discountPerPiece: Math.max(1, this.getDiscountPercentageDiscount(d))
            }))
        }
        this.addPatch(p)
    }

    getDiscountDiscountPerPiece(d: ProductDiscount) {
        return d.discountPerPiece
    }

    setDiscountDiscountPerPiece(d: ProductDiscount, discountPerPiece: number) {
        const p = ProductDiscountSettings.patch({})
        p.discounts.addPatch(ProductDiscount.patch({
            id: d.id,
            percentageDiscount: 0,
            discountPerPiece: discountPerPiece
        }))
        this.addPatch(p)
    }

    getDiscountPercentageDiscount(d: ProductDiscount) {
        return d.percentageDiscount
    }

    setDiscountPercentageDiscount(d: ProductDiscount, percentageDiscount: number) {
        const p = ProductDiscountSettings.patch({})
        p.discounts.addPatch(ProductDiscount.patch({
            id: d.id,
            percentageDiscount,
            discountPerPiece: 0
        }))
        this.addPatch(p)
    }

    addDiscount() {
        const p = ProductDiscountSettings.patch({})
        p.discounts.addPut(ProductDiscount.create({}))
        this.addPatch(p)
    }

    removeDiscount(discount: ProductDiscount) {
        const p = ProductDiscountSettings.patch({})
        p.discounts.addDelete(discount.id)
        this.addPatch(p)
    }
    
    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }
        const p: PatchableArrayAutoEncoder<ProductDiscountSettings> = new PatchableArray()
        p.addPatch(this.patchProductDiscount)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze korting wilt verwijderen?", "Verwijderen")) {
            return
        }

        const p: PatchableArrayAutoEncoder<ProductDiscountSettings> = new PatchableArray()
        p.addDelete(this.productDiscount.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchProductDiscount, this.productDiscount, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>