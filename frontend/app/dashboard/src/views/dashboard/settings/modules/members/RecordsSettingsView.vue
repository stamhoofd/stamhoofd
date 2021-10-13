<template>
    <div id="records-settings-view" class="st-view background">
        <STNavigationBar title="Eigen kenmerken en gegevens">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Kenmerken en gegevens van leden
            </h1>
            <p>Je kan zelf kiezen welke extra informatie je van jouw leden wilt verzamelen. Stamhoofd heeft enkele ingebouwde zaken, maar je kan de informatie die je wilt verzamelen zo veel uitbreiden als je wilt.</p>
            
            <STErrorsDefault :error-box="errorBox" />

            <hr>
            <h2>Ingebouwde gegevens</h2>

            <p>Bepaalde gegevens zijn ingebouwd in Stamhoofd zodat we die ook op een speciale manier kunnen verwerken. Je kan deze hier aan of uit zetten, en eventueel bepaalde gegevens optioneel maken (altijd of bijvoorbeeld op basis van de leeftijd).</p>

            <STList>
                <STListItem>
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('phone')" @change="setEnableFilterConfiguration('phone', $event)" />
                    <p class="style-title-list">
                        GSM-nummer (van lid zelf)
                    </p>
                    <p v-if="getEnableFilterConfiguration('phone')" class="style-description-small">
                        {{ patchedOrganization.meta.recordsConfiguration.phone }}
                    </p>
                    <button v-if="getEnableFilterConfiguration('phone')" slot="right" class="button text" type="button" @click="editEnableFilterConfiguration('phone', 'GSM-nummer')">
                        <span clas="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
                <STListItem>
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('emailAddress')" @change="setEnableFilterConfiguration('emailAddress', $event)" />
                    <p class="style-title-list">
                        E-mailadres (van lid zelf)
                    </p>
                    <p v-if="getEnableFilterConfiguration('emailAddress')" class="style-description-small">
                        {{ patchedOrganization.meta.recordsConfiguration.emailAddress }}
                    </p>
                    <button v-if="getEnableFilterConfiguration('emailAddress')" slot="right" class="button text" type="button" @click="editEnableFilterConfiguration('emailAddress', 'E-mailadres')">
                        <span clas="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
                <STListItem>
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('gender')" @change="setEnableFilterConfiguration('gender', $event)" />
                    <p class="style-title-list">
                        Geslacht
                    </p>
                    <p v-if="getEnableFilterConfiguration('gender')" class="style-description-small">
                        {{ patchedOrganization.meta.recordsConfiguration.gender }}
                    </p>
                    <button v-if="getEnableFilterConfiguration('gender')" slot="right" class="button text" type="button" @click="editEnableFilterConfiguration('gender', 'Geslacht')">
                        <span clas="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
                <STListItem>
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('birthDay')" @change="setEnableFilterConfiguration('birthDay', $event)" />
                    <p class="style-title-list">
                        Geboortedatum
                    </p>
                    <p v-if="getEnableFilterConfiguration('birthDay')" class="style-description-small">
                        {{ patchedOrganization.meta.recordsConfiguration.birthDay }}
                    </p>
                    <button v-if="getEnableFilterConfiguration('birthDay')" slot="right" class="button text" type="button" @click="editEnableFilterConfiguration('birthDay', 'Geboortedatum')">
                        <span clas="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
                <STListItem>
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('address')" @change="setEnableFilterConfiguration('address', $event)" />
                    <p class="style-title-list">
                        Adres (van lid zelf)
                    </p>
                    <p v-if="getEnableFilterConfiguration('address')" class="style-description-small">
                        {{ patchedOrganization.meta.recordsConfiguration.address }}
                    </p>
                    <button v-if="getEnableFilterConfiguration('address')" slot="right" class="button text" type="button" @click="editEnableFilterConfiguration('address', 'Adres')">
                        <span clas="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
                <STListItem>
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('parents')" @change="setEnableFilterConfiguration('parents', $event)" />
                    <p class="style-title-list">
                        Ouders
                    </p>
                    <p v-if="getEnableFilterConfiguration('parents')" class="style-description-small">
                        {{ patchedOrganization.meta.recordsConfiguration.parents }}
                    </p>
                    <button v-if="getEnableFilterConfiguration('parents')" slot="right" class="button text" type="button" @click="editEnableFilterConfiguration('parents', 'Ouders')">
                        <span clas="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
                <STListItem>
                    <Checkbox slot="left" :checked="getEnableFilterConfiguration('emergencyContacts')" @change="setEnableFilterConfiguration('emergencyContacts', $event)" />
                    <p class="style-title-list">
                        Noodcontactpersoon
                    </p>
                    <p v-if="getEnableFilterConfiguration('emergencyContacts')" class="style-description-small">
                        {{ patchedOrganization.meta.recordsConfiguration.emergencyContacts }}
                    </p>
                    <button v-if="getEnableFilterConfiguration('emergencyContacts')" slot="right" class="button text" type="button" @click="editEnableFilterConfiguration('emergencyContacts', 'Noodcontactpersoon')">
                        <span clas="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
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

            <p class="info-box">
                Nog even geduld. Het wordt binnenkort mogelijk om zelf kenmerken toe te voegen aan leden die niet zichtbaar zijn voor die leden zelf. Bv. om de status van iets bij te houden.
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
import { BackButton, CenteredMessage, Checkbox,ErrorBox, LoadingButton,PropertyFilterView,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { AskRequirement, MemberDetails, MemberDetailsWithGroups, Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, PropertyFilter, RecordCategory,Version  } from "@stamhoofd/structures"
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

    get organization() {
        return OrganizationManager.organization
    }

    get patchedOrganization() {
        return this.organization.patch(this.organizationPatch)
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
        this.addPatch(Organization.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    [property]: patch
                })
            })
        }))
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
            const def = OrganizationRecordsConfiguration.create({})
            this.patchConfigProperty(
                property, 
                // try to resuse the settings if they existed
                this.organization.meta.recordsConfiguration[property] ?? def[property] ?? PropertyFilter.createDefault(MemberDetailsWithGroups.getBaseFilterDefinitions())
            )
        } else {
            this.patchConfigProperty(property, null)
        }
    }

    editEnableFilterConfiguration(property: string, title: string) {
        this.present(new ComponentWithProperties(PropertyFilterView, {
            configuration: this.patchedOrganization.meta.recordsConfiguration[property],
            title,
            organization: this.patchedOrganization,
            setConfiguration: (configuration: PropertyFilter<MemberDetails>) => {
                this.patchConfigProperty(property, configuration)
            }
        }).setDisplayStyle("popup"))
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
