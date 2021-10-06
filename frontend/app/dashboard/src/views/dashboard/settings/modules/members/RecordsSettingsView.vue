<template>
    <div id="records-settings-view" class="st-view background">
        <STNavigationBar title="Eigen kenmerken en gegevens">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Eigen kenmerken en gegevens
            </h1>
            <p>Je kan zelf kiezen welke extra informatie je van jouw leden wilt verzamelen. Stamhoofd heeft enkele ingebouwde zaken, maar je kan de informatie die je wilt verzamelen zo veel uitbreiden als je wilt.</p>

           
            
            <STErrorsDefault :error-box="errorBox" />

            <hr>
            <h2>Ingebouwde gegevens</h2>

            <p>Bepaalde gegevens van leden zijn ingebouwd in Stamhoofd zodat we die ook op een speciale manier kunnen verwerken. Gebruik deze en voeg deze zaken niet zelf toe als vragen!</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('emailAddress')" @change="setEnableFilterConfiguration('emailAddress', $event)" />
                    <p class="style-title-list">
                        E-mailadres (van lid zelf)
                    </p>
                    <PropertyFilterConfigurationInput @click.native.prevent v-if="getEnableFilterConfiguration('emailAddress')" :configuration="patchedOrganization.meta.recordsConfiguration.emailAddress" :definitions="definitions" @patch="patchConfigProperty('emailAddress', $event)" />
                </STListItem>
            </STList>

            <hr>
            <h2>Vragen tijdens inschrijven</h2>

            <p>
                Voeg zelf kenmerken toe die ingevuld kunnen worden bij het inschrijven. De kenmerken worden onderverdeeld in verschillende categorieën om de structuur te bewaren.
            </p>

            <STList>
                <RecordCategoryRow v-for="category in categories" :key="category.id" :category="category" :categories="categories" :selectable="true" @patch="addCategoriesPatch" />
            </STList>

            <p>
                <button class="button text" @click="addCategory">
                    <span class="icon add" />
                    <span>Nieuwe categorie</span>
                </button>
            </p>

            <hr>
            <h2>Interne gegevens</h2>

            <p>
                Je kan ook kenmerken toevoegen die enkel zichtbaar zijn voor beheerders.
            </p>

            <STList>
                <RecordCategoryRow v-for="category in categories" :key="category.id" :category="category" :categories="categories" :selectable="true" @patch="addCategoriesPatch" />
            </STList>

            <p>
                <button class="button text" @click="addCategory">
                    <span class="icon add" />
                    <span>Nieuwe categorie</span>
                </button>
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox,ErrorBox, LoadingButton, PropertyFilterConfigurationInput,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { AskRequirement, MemberWithRegistrations, Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, PropertyFilterConfiguration, RecordCategory,Version  } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import EditRecordCategoryView from './records/EditRecordCategoryView.vue';
import RecordCategoryRow from "./records/RecordCategoryRow.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        BackButton,
        LoadingButton,
        RecordCategoryRow,
        STListItem,
        PropertyFilterConfigurationInput,
        Checkbox
    },
})
export default class RecordsSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    // Make it reactive
    OrganizationManager = OrganizationManager

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get AskRequirement() {
        return AskRequirement
    }

    get definitions() {
        return MemberWithRegistrations.getBaseFilterDefinitions()
    }

    get patchedOrganization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get categories() {
        return this.patchedOrganization.meta.recordsConfiguration.recordCategories
    }

    get emergencyContact() {
        return this.patchedOrganization.meta.recordsConfiguration.emergencyContact
    }

    set emergencyContact(val: AskRequirement) {
        this.addRecordsConfigurationPatch(OrganizationRecordsConfiguration.patch({
            emergencyContact: val
        }))
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.organizationPatch = this.organizationPatch.patch(patch)
    }

    patchConfigProperty(property: string, patch: any) {
        console.log(property, patch)
        console.log({
                    [property]: patch
                })
        this.addPatch(Organization.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    [property]: patch
                })
            })
        }))

        console.log(this.organizationPatch)
    }

    addRecordsConfigurationPatch(patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) {
        this.addPatch(Organization.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: patch
            })
        }))
    }

    addCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
        const p = OrganizationRecordsConfiguration.patch({
            recordCategories: patch
        })
        this.addRecordsConfigurationPatch(p)
    }

    addCategory() {
        const category = RecordCategory.create({})

        this.present(new ComponentWithProperties(EditRecordCategoryView, {
            category,
            isNew: true,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                this.addCategoriesPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }
    
    getEnableFilterConfiguration(property: string) {
        return this.patchedOrganization.meta.recordsConfiguration[property] !== null
    }

    setEnableFilterConfiguration(property: string, enable: boolean) {
        if (enable === this.getEnableFilterConfiguration(property)) {
            return
        }
        if (enable) {
            this.patchConfigProperty(property, PropertyFilterConfiguration.create({}))
        } else {
            this.patchConfigProperty(property, null)
        }
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
      
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            await OrganizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: OrganizationManager.organization.id })
            new Toast('De wijzigingen zijn opgeslagen', "success green").show()
            this.dismiss({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
   
    mounted() {
        HistoryManager.setUrl("/settings/records");
    }
}
</script>
