<template>
    <SaveView :title="isNew ? 'Productkorting toevoegen' : 'Productkorting bewerken'" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            Productkorting toevoegen
        </h1>
        <h1 v-else>
            Productkorting bewerken
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <ProductSelectorBox :productSelector="productSelector" @patch="patchProductSelector" :webshop="webshop" :validator="validator" />

        <div v-for="d in discounts" :key="d.id">
            <STInputBox title="Korting op 1e stuk" :error-box="errorBox" class="max">
                <button slot="right" class="button icon trash gray" type="button" @click="removeDiscount(d)" v-if="discounts.length > 1" />

                <div class="split-inputs">
                    <div>
                        <Dropdown :value="getDiscountType(d)" @change="setDiscountType(d, $event)">
                            <option value="percentageDiscount">Percentage</option>
                            <option value="discountPerPiece">Bedrag</option>
                        </Dropdown>
                    </div>
                    <div>
                        <PriceInput v-if="getDiscountType(d) == 'discountPerPiece'" :value="getDiscountDiscountPerPiece(d)" @input="setDiscountDiscountPerPiece(d, $event)" :min="0" :required="true" />
                        <PermyriadInput v-else :value="getDiscountPercentageDiscount(d)" @input="setDiscountPercentageDiscount(d, $event)" :required="true" />
                    </div>
                </div>
            </STInputBox>
        </div>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add" />
                <span>Toevoegen</span>
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
                <Radio slot="left" v-model="repeatBehaviour" value="Once" />
                <h3 class="style-title-list">
                    Niet herhalen
                </h3>
                <p class="style-description">
                    De korting wordt maar één keer toegepast.
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <Radio slot="left" v-model="repeatBehaviour" value="RepeatLast" />
                <h3 class="style-title-list">
                    Laatste korting herhalen
                </h3>
                <p class="style-description">
                    De laatste korting uit de lijst wordt toegepast als er nog meer stuks zijn.
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label" class="left-center">
                <Radio slot="left" v-model="repeatBehaviour" value="RepeatPattern" />
                <h3 class="style-title-list">
                    Patroon herhalen
                </h3>
                <p class="style-description">
                    Als er meer stuks zijn wordt de eerste korting terug toegepast, daarna de tweede...
                </p>
            </STListItem>
        </STList>

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
import { CenteredMessage, Checkbox, ErrorBox, NumberInput, PermyriadInput, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator, Dropdown, Radio } from "@stamhoofd/components";
import { ProductDiscountSettings, PrivateWebshop, ProductSelector, Version, ProductDiscount, ProductDiscountRepeatBehaviour } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../classes/OrganizationManager';
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

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patch: PatchableArrayAutoEncoder<ProductDiscountSettings>) => void;
    
    get patchedProductDiscount() {
        return this.productDiscount.patch(this.patchProductDiscount)
    }

    get organization() {
        return OrganizationManager.organization
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

    getDiscountType(d: ProductDiscount) {
        if (d.percentageDiscount > 0) {
            return 'percentageDiscount'
        }
        return 'discountPerPiece'
    }

    setDiscountType(d: ProductDiscount, type: 'percentageDiscount' | 'discountPerPiece') {
        const p = ProductDiscountSettings.patch({})
        if (type === 'percentageDiscount') {
            p.discounts.addPatch(ProductDiscount.patch({
                id: d.id,
                percentageDiscount: 10,
                discountPerPiece: 0
            }))
        } else {
            p.discounts.addPatch(ProductDiscount.patch({
                id: d.id,
                percentageDiscount: 0,
                discountPerPiece: 0
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