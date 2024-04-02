<template>
    <SaveView :title="isNew ? 'Kortingscode toevoegen' : 'Kortingscode bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Kortingscode toevoegen
        </h1>
        <h1 v-else>
            Kortingscode bewerken
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Code" error-fields="code" :error-box="errorBox">
            <input
                v-model="code"
                class="input"
                type="text"
                placeholder="Bv; 'BLACK-FRIDAY"
                autocomplete=""
                @blur="cleanCode"
            >
        </STInputBox>
        <p class="style-description-small" v-if="!code">Kies zelf een code of <button type="button" class="inline-link" @click="generateCode()">genereer één willekeurig</button></p>
        <p class="style-description-small" v-else>De kortingscode kan gebruikt worden via <span class="style-copyable style-inline-code" v-copyable="'https://'+link">{{link}}</span></p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <Checkbox slot="left" v-model="useMaximumUsage" />

                <h3 class="style-title-list">
                    Beperk aantal keer te gebruiken (waarvan al {{ patchedDiscountCode.usageCount }} keer gebruikt)
                </h3>

                <div v-if="useMaximumUsage" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errorBox">
                        <NumberInput v-model="maximumUsage" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <STInputBox title="Beschrijving" class="max" error-fields="description" :error-box="errorBox">
            <textarea
                v-model="description"
                class="input"
                placeholder="Optioneel"
                autocomplete=""
            ></textarea>
        </STInputBox>
        <p class="style-description-small">De beschrijving is een interne referentie, en is niet zichtbaar voor bestellers.</p>

        <hr>
        <h2>
            Kortingen
        </h2>
        <p>Je kan één of meerdere kortingen verbinden aan een kortingscode.</p>

        <STList v-if="patchedDiscountCode.discounts.length">
            <STListItem v-for="discount of patchedDiscountCode.discounts" :key="discount.id" class="right-description right-stack" :selectable="true" @click="editDiscount(discount)">
                <h3 class="style-title-list">
                    {{getDiscountTitle(discount).title}}
                </h3>
                <p class="style-description-small" v-if="getDiscountTitle(discount).description">
                    {{getDiscountTitle(discount).description}}
                </p>
                <p v-if="getDiscountTitle(discount).footnote" class="style-description-small pre-wrap" v-text="getDiscountTitle(discount).footnote"/>

                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add" />
                <span>Korting toevoegen</span>
            </button>
        </p>
      
        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze code
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
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, NumberInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator, PermyriadInput, PriceInput, Checkbox } from "@stamhoofd/components";
import { Discount, DiscountCode, DiscountRequirement, GeneralDiscount, PrivateWebshop, ProductDiscount, ProductDiscountSettings, ProductSelector, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../classes/OrganizationManager';
import EditDiscountRequirementView from './EditDiscountRequirementView.vue';
import EditDiscountView from './EditDiscountView.vue';
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
export default class EditDiscountCodeView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        discountCode!: DiscountCode

    @Prop({ required: true })
        isNew!: boolean

    @Prop({ required: true })
        webshop: PrivateWebshop

    /// For now only used to update locations and times of other products that are shared
    patchDiscountCode: AutoEncoderPatchType<DiscountCode> = DiscountCode.patch({ id: this.discountCode.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => void;
    
    get patchedDiscountCode() {
        return this.discountCode.patch(this.patchDiscountCode)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get link() {
        const cleaned = Formatter.slug(this.code).toUpperCase()
        return this.webshop.getUrl(this.organization) + '/code/' + cleaned
    }

    getDiscountTitle(discount: Discount) {
        return discount.getTitle(this.webshop, true)
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    addPatch(patch: AutoEncoderPatchType<DiscountCode>) {
        this.patchDiscountCode = this.patchDiscountCode.patch(patch)
    }

    get code() {
        return this.patchedDiscountCode.code
    }

    set code(code: string) {
        this.addPatch(DiscountCode.patch({
            code
        }))
    }

    get description() {
        return this.patchedDiscountCode.description
    }
    
    set description(description: string) {
        this.addPatch(DiscountCode.patch({
            description
        }))
    }

    get maximumUsage() {
        return this.patchedDiscountCode.maximumUsage
    }

    set maximumUsage(maximumUsage: number|null) {
        this.addPatch(DiscountCode.patch({
            maximumUsage
        }))
    }

    get useMaximumUsage() {
        return this.maximumUsage !== null
    }

    set useMaximumUsage(useMaximumUsage: boolean) {
        if (useMaximumUsage) {
            this.maximumUsage = this.maximumUsage ?? this.discountCode.maximumUsage ?? 1
        } else {
            this.maximumUsage = null
        }
    }

    addDiscountsPatch(d: PatchableArrayAutoEncoder<Discount>) {
        const meta = DiscountCode.patch({
            discounts: d,
        })
        this.addPatch(meta)
    }

    addDiscount() {
        const discount = Discount.create({})
        const arr: PatchableArrayAutoEncoder<Discount> = new PatchableArray();
        arr.addPut(discount);

        this.present({
            components: [
                new ComponentWithProperties(EditDiscountView, {
                    isNew: true,
                    discount,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                        arr.merge(patch);
                        this.addDiscountsPatch(arr)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    editDiscount(discount: Discount) {
        this.present({
            components: [
                new ComponentWithProperties(EditDiscountView, {
                    isNew: false,
                    discount,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                        this.addDiscountsPatch(patch)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    cleanCode() {
        this.code = Formatter.slug(this.code).toUpperCase()
    }

    validate() {
        if (this.code.length === 0) {
            throw new SimpleError({
                code: 'required_field',
                field: 'code',
                message: 'Vul een code in'
            })
        }

        if (this.patchedDiscountCode.discounts.length === 0) {
            throw new SimpleError({
                code: 'required_field',
                field: 'discounts',
                message: 'Voeg minstens één korting toe'
            })
        }
    }

    async save() {
        this.cleanCode()
        
        const isValid = await this.validator.validate()
        this.errorBox = null;

        try {
            this.validate()
        } catch (e) {
            this.errorBox = new ErrorBox(e);
            return;
        }

        if (!isValid) {
            return
        }
        const p: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray()
        p.addPatch(this.patchDiscountCode)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze kortingscode wilt verwijderen?", "Verwijderen")) {
            return
        }

       const p: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray()
        p.addDelete(this.discountCode.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchDiscountCode, this.discountCode, { version: Version })
    }

    generateCode() {
        function nextChar() {
            // All characters except difficult to differentiate characters in uppercase (0, O, 1, L, I)
            const allowList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7', '8', '9']
            return allowList[Math.floor(Math.random() * allowList.length)]
        }

        function nextChars(num = 4) {
            let result = ''
            for (let i = 0; i < num; i++) {
                result += nextChar()
            }
            return result
        }

        this.code = nextChars(4) + '-' + nextChars(4) + '-' + nextChars(4) + '-' + nextChars(4)
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

}
</script>