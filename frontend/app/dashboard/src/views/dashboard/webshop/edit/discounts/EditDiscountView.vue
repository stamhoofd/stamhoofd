<template>
    <SaveView :title="isNew ? 'Korting toevoegen' : 'Korting bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Korting toevoegen
        </h1>
        <h1 v-else>
            Korting bewerken
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>
            Artikelvoorwaarden
        </h2>
        <p>De korting wordt enkel toegepast als deze artikels met een bepaalde hoeveelheid aanwezig zijn in het winkelmandje.</p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem v-for="requirement of patchedDiscount.requirements" :key="requirement.id" class="right-description right-stack" :selectable="true" @click="editRequirement(requirement)">
                <h3 class="style-title-list">
                    {{requirement.amount}} x {{requirement.product.getName(webshop, true).name}}
                </h3>
                <p class="style-description-small">
                    {{requirement.product.getName(webshop, true).footnote}}
                </p>

                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addRequirement">
                <span class="icon add" />
                <span>Artikelvoorwaarde toevoegen</span>
            </button>
        </p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem :selectable="true" element-name="label">
                <Checkbox slot="left" v-model="applyMultipleTimes" />

                <h3 class="style-title-list">
                    Meerdere keren toepassen
                </h3>
                <p class="style-description-small">
                    Als de vereiste artikels meerdere keren aanwezig zijn, dan wordt de korting meerdere keren toegepast. Ideaal voor bijvoorbeeld een 2 + 1 gratis actie, of x euro korting per 2 bestelde stuks.
                </p>
            </STListItem>
        </STList>

        <hr>

        <h2>
            Korting op volledige bestelling
        </h2>
        
        <div class="split-inputs">
            <STInputBox title="Vast bedrag" error-fields="administrationFee.fixed" :error-box="errorBox">
                <PriceInput v-model="fixedDiscount" :min="0" placeholder="Vaste kost" :required="true" />
            </STInputBox>

            <STInputBox title="Percentage" error-fields="administrationFee.fixed" :error-box="errorBox">
                <PermyriadInput v-model="percentageDiscount" placeholder="Percentage" :required="true" />
            </STInputBox>
        </div>

        <p class="style-description-small">Indien er meerdere kortingen op bestelniveau van toepassing zijn wordt het vaste bedrag opgeteld, bij het percentage wordt het hoogste genomen (niet opgeteld).

        <hr>
        <h2>
            Korting op specifieke artikels
        </h2>
        <p>Je kan een procentuele korting geven op bepaalde artikels, je kan één artikel gratis maken, je kan een korting per stuk geven op de eerste x aantal stuks (of alle stuks) van een artikel...</p>

        <STList v-if="patchedDiscount.productDiscounts.length">
            <STListItem v-for="productDiscount of patchedDiscount.productDiscounts" :key="productDiscount.id" class="right-description right-stack" :selectable="true" @click="editProductDiscount(productDiscount)">
                <h3 class="style-title-list">
                    {{productDiscount.getTitle(webshop, true).title}}
                </h3>
                <p class="style-description-small">
                     {{productDiscount.getTitle(webshop, true).description}}
                </p>
                <p class="style-description-small">
                     {{productDiscount.getTitle(webshop, true).footnote}}
                </p>

                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addProductDiscount">
                <span class="icon add" />
                <span>Artikel toevoegen</span>
            </button>
        </p>
      
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, NumberInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator, PermyriadInput, PriceInput, Checkbox } from "@stamhoofd/components";
import { Discount, DiscountRequirement, GeneralDiscount, PrivateWebshop, ProductDiscount, ProductDiscountSettings, ProductSelector, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../classes/OrganizationManager';
import EditDiscountRequirementView from './EditDiscountRequirementView.vue';
import EditProductDiscountView from './EditProductDiscountView.vue';

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
        Checkbox
    },
})
export default class EditDiscountView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        discount!: Discount

    @Prop({ required: true })
        isNew!: boolean

    @Prop({ required: true })
        webshop: PrivateWebshop

    /// For now only used to update locations and times of other products that are shared
    patchDiscount: AutoEncoderPatchType<Discount> = Discount.patch({ id: this.discount.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => void;
    
    get patchedDiscount() {
        return this.discount.patch(this.patchDiscount)
    }

    get organization() {
        return OrganizationManager.organization
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    addPatch(patch: AutoEncoderPatchType<Discount>) {
        this.patchDiscount = this.patchDiscount.patch(patch)
    }

    get applyMultipleTimes() {
        return this.patchedDiscount.applyMultipleTimes
    }

    set applyMultipleTimes(applyMultipleTimes: boolean) {
        this.addPatch(Discount.patch({
            applyMultipleTimes
        }))
    }

    get fixedDiscount() {
        return this.patchedDiscount.orderDiscount.fixedDiscount
    }

    set fixedDiscount(fixedDiscount: number) {
        this.addPatch(Discount.patch({
            orderDiscount: GeneralDiscount.patch({
                fixedDiscount
            })
        }))
    }

    get percentageDiscount() {
        return this.patchedDiscount.orderDiscount.percentageDiscount
    }

    set percentageDiscount(percentageDiscount: number) {
        this.addPatch(Discount.patch({
            orderDiscount: GeneralDiscount.patch({
                percentageDiscount
            })
        }))
    }

    addRequirementsPatch(d: PatchableArrayAutoEncoder<DiscountRequirement>) {
        const meta = Discount.patch({
            requirements: d,
        })
        this.addPatch(meta)
    }

    addProductDiscountPatch(d: PatchableArrayAutoEncoder<ProductDiscountSettings>) {
        const meta = Discount.patch({
            productDiscounts: d,
        })
        this.addPatch(meta)
    }

    addRequirement() {
        const requirement = DiscountRequirement.create({
            product: ProductSelector.create({
                productId: this.webshop.products[0].id
            })
        })
        const arr: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray();
        arr.addPut(requirement);

        this.present({
            components: [
                new ComponentWithProperties(EditDiscountRequirementView, {
                    isNew: true,
                    discountRequirement: requirement,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountRequirement>) => {
                        arr.merge(patch);
                        this.addRequirementsPatch(arr)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    editRequirement(discountRequirement: DiscountRequirement) {
        this.present({
            components: [
                new ComponentWithProperties(EditDiscountRequirementView, {
                    isNew: false,
                    discountRequirement: discountRequirement,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountRequirement>) => {
                        this.addRequirementsPatch(patch)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    addProductDiscount() {
        const productDiscount = ProductDiscountSettings.create({
            product: ProductSelector.create({
                productId: this.webshop.products[0].id
            })
        })
        const arr: PatchableArrayAutoEncoder<ProductDiscountSettings> = new PatchableArray();
        arr.addPut(productDiscount);

        this.present({
            components: [
                new ComponentWithProperties(EditProductDiscountView, {
                    isNew: true,
                    productDiscount,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<ProductDiscountSettings>) => {
                        arr.merge(patch);
                        this.addProductDiscountPatch(arr)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    editProductDiscount(productDiscount: ProductDiscountSettings) {
        this.present({
            components: [
                new ComponentWithProperties(EditProductDiscountView, {
                    isNew: false,
                    productDiscount,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<ProductDiscountSettings>) => {
                        this.addProductDiscountPatch(patch)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }
        const p: PatchableArrayAutoEncoder<Discount> = new PatchableArray()
        p.addPatch(this.patchDiscount)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze korting wilt verwijderen?", "Verwijderen")) {
            return
        }

       const p: PatchableArrayAutoEncoder<Discount> = new PatchableArray()
        p.addDelete(this.discount.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchDiscount, this.discount, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>