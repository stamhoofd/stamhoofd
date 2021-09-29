<template>
    <div class="st-view record-category-edit-view">
        <STNavigationBar :title="isNew ? typeName+' toevoegen' : name+' bewerken'">
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
                {{ typeName }} toevoegen
            </h1>
            <h1 v-else>
                {{ name || typeName }} bewerken
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        :placeholder="'Naam '+typeName"
                        autocomplete=""
                    >
                </STInputBox>
                <STInputBox v-if="isTicket" title="Type" error-fields="name" :error-box="errorBox">
                    <select
                        v-model="type"
                        class="input"
                        type="text"
                    >
                        <option>Ticket</option>
                        <option>Voucher</option>
                    </select>
                </STInputBox>
            </div>

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="max">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Beschrijving van dit artikel"
                    autocomplete=""
                />
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
import { AutoEncoderPatchType, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, ErrorBox, NumberInput, PriceInput, Radio, RadioGroup, SegmentedControl, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, UploadButton, Validator } from "@stamhoofd/components";
import { Image, OptionMenu, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, ProductDateRange, ProductLocation, ProductPrice, ProductType, RecordCategory, ResolutionFit, ResolutionRequest, Version, WebshopField, WebshopTicketType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import WebshopFieldsBox from "../fields/WebshopFieldsBox.vue"
import EditOptionMenuView from './EditOptionMenuView.vue';
import EditProductPriceView from './EditProductPriceView.vue';
import OptionMenuSection from "./OptionMenuSection.vue"
import ProductPriceBox from "./ProductPriceBox.vue"
import ProductPriceRow from "./ProductPriceRow.vue"
import ProductSelectDateRangeInput from "./ProductSelectDateRangeInput.vue"
import ProductSelectLocationInput from "./ProductSelectLocationInput.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        NumberInput,
        Spinner,
        UploadButton,
        ProductPriceRow,
        STList,
        OptionMenuSection,
        ProductPriceBox,
        WebshopFieldsBox,
        ProductSelectLocationInput,
        ProductSelectDateRangeInput
    },
})
export default class EditRecordCategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    category!: RecordCategory

    @Prop({ required: true })
    isNew!: boolean

    @Prop({ required: true })
    organization: Organization

    /// For now only used to update locations and times of other products that are shared
    patchOrganization:  AutoEncoderPatchType<Organization> = Organization.patch({})
    patchCategory: AutoEncoderPatchType<RecordCategory> = RecordCategory.patch({ id: this.category.id })

    /**
     * If we can immediately save this category, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patchOrganization: AutoEncoderPatchType<Organization>) => void;

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get patchedCategory() {
        return this.category.patch(this.patchCategory)
    }

    get typeName(): string {
        return "Categorie"
    }

    get name() {
        return this.patchedCategory.name
    }

    set name(name: string) {
        this.patchCategory = this.patchCategory.patch({ name })
    }

    get description() {
        return this.patchedCategory.description
    }

    set description(description: string) {
        this.patchCategory = this.patchCategory.patch({ description })
    }

    addPatch(patch: AutoEncoderPatchType<RecordCategory>) {
        this.patchCategory = this.patchCategory.patch(patch)
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        const recordsConfiguration = OrganizationRecordsConfiguration.patch({})
        recordsConfiguration.recordCategories.addPatch(this.patchCategory)

        const p = this.patchOrganization.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration
            })
        })

        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen", "Alle kenmerken worden hierdoor ook verwijderd.")) {
            return
        }

        const recordsConfiguration = OrganizationRecordsConfiguration.patch({})
        recordsConfiguration.recordCategories.addDelete(this.category.id)

        const p = Organization.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration
            })
        })

        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchCategory, this.category, { version: Version })
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
@use "@stamhoofd/scss/base/variables.scss" as *;

.category-edit-view {
    img.image {
        margin: 15px 0;
        height: 140px;
        border-radius: $border-radius;
    }
}
</style>
