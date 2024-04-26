<template>
    <SaveView :title="isNew ? 'Kortingvoorwaarde toevoegen' : 'Kortingvoorwaarde bewerken'" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            Kortingvoorwaarde toevoegen
        </h1>
        <h1 v-else>
            Kortingvoorwaarde bewerken
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <ProductSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="validator" @patch="patchProductSelector" />

        <STInputBox title="Aantal" error-fields="amount" :error-box="errorBox" class="max">
            <NumberInput
                v-model="amount"
                :min="1"
                :stepper="true"
            />
        </STInputBox>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze voorwaarde
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
import { CenteredMessage, Checkbox, ErrorBox, NumberInput, PermyriadInput, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { DiscountRequirement, PrivateWebshop, ProductSelector, Version } from '@stamhoofd/structures';
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
        ProductSelectorBox
    },
})
export default class EditDiscountRequirementView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        discountRequirement!: DiscountRequirement

    @Prop({ required: true })
        isNew!: boolean

    @Prop({ required: true })
        webshop: PrivateWebshop

    /// For now only used to update locations and times of other products that are shared
    patchDiscountRequirement: AutoEncoderPatchType<DiscountRequirement> = DiscountRequirement.patch({ id: this.discountRequirement.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patch: PatchableArrayAutoEncoder<DiscountRequirement>) => void;
    
    get patchedDiscountRequirement() {
        return this.discountRequirement.patch(this.patchDiscountRequirement)
    }

    get organization() {
        return this.$organization
    }

    get productSelector() {
        return this.patchedDiscountRequirement.product
    }

    patchProductSelector(patch: AutoEncoderPatchType<ProductSelector>) {
        this.addPatch(DiscountRequirement.patch({
            product: patch
        }))
    }

    addPatch(patch: AutoEncoderPatchType<DiscountRequirement>) {
        this.patchDiscountRequirement = this.patchDiscountRequirement.patch(patch)
    }

    get amount() {
        return this.patchedDiscountRequirement.amount
    }

    set amount(amount: number) {
        this.addPatch(DiscountRequirement.patch({
            amount
        }))
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }
        const p: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray()
        p.addPatch(this.patchDiscountRequirement)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze voorwaarde wilt verwijderen?", "Verwijderen")) {
            return
        }

        const p: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray()
        p.addDelete(this.discountRequirement.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchDiscountRequirement, this.discountRequirement, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

</style>
