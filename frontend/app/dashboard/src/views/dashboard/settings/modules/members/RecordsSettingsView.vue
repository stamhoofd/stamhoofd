<template>
    <SaveView :loading="saving" title="Kenmerken en gegevens van leden" :disabled="!hasChanges" @save="save">
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
                    {{ $t('shared.inputs.mobile.label') }} (van lid zelf)
                </p>
                <p v-if="getEnableFilterConfiguration('phone')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.phone }}
                </p>
                <button v-if="getEnableFilterConfiguration('phone')" slot="right" class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('phone', $t('shared.inputs.mobile.label'))" />
            </STListItem>
            <STListItem>
                <Checkbox slot="left" :checked="getEnableFilterConfiguration('emailAddress')" @change="setEnableFilterConfiguration('emailAddress', $event)" />
                <p class="style-title-list">
                    E-mailadres (van lid zelf)
                </p>
                <p v-if="getEnableFilterConfiguration('emailAddress')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.emailAddress }}
                </p>
                <button v-if="getEnableFilterConfiguration('emailAddress')" slot="right" class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('emailAddress', 'E-mailadres')" />
            </STListItem>
            <STListItem>
                <Checkbox slot="left" :checked="getEnableFilterConfiguration('gender')" @change="setEnableFilterConfiguration('gender', $event)" />
                <p class="style-title-list">
                    Geslacht
                </p>
                <p v-if="getEnableFilterConfiguration('gender')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.gender }}
                </p>
                <button v-if="getEnableFilterConfiguration('gender')" slot="right" class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('gender', 'Geslacht')" />
            </STListItem>
            <STListItem>
                <Checkbox slot="left" :checked="getEnableFilterConfiguration('birthDay')" @change="setEnableFilterConfiguration('birthDay', $event)" />
                <p class="style-title-list">
                    Geboortedatum
                </p>
                <p v-if="getEnableFilterConfiguration('birthDay')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.birthDay }}
                </p>
                <button v-if="getEnableFilterConfiguration('birthDay')" slot="right" class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('birthDay', 'Geboortedatum')" />
            </STListItem>
            <STListItem>
                <Checkbox slot="left" :checked="getEnableFilterConfiguration('address')" @change="setEnableFilterConfiguration('address', $event)" />
                <p class="style-title-list">
                    Adres (van lid zelf)
                </p>
                <p v-if="getEnableFilterConfiguration('address')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.address }}
                </p>
                <button v-if="getEnableFilterConfiguration('address')" slot="right" class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('address', 'Adres')" />
            </STListItem>
            <STListItem>
                <Checkbox slot="left" :checked="getEnableFilterConfiguration('parents')" @change="setEnableFilterConfiguration('parents', $event)" />
                <p class="style-title-list">
                    Ouders
                </p>
                <p v-if="getEnableFilterConfiguration('parents')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.parents }}
                </p>
                <button v-if="getEnableFilterConfiguration('parents')" slot="right" class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('parents', 'Ouders')" />
            </STListItem>
            <STListItem>
                <Checkbox slot="left" :checked="getEnableFilterConfiguration('emergencyContacts')" @change="setEnableFilterConfiguration('emergencyContacts', $event)" />
                <p class="style-title-list">
                    Noodcontactpersoon
                </p>
                <p v-if="getEnableFilterConfiguration('emergencyContacts')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.emergencyContacts }}
                </p>
                <button v-if="getEnableFilterConfiguration('emergencyContacts')" slot="right" class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('emergencyContacts', 'Noodcontactpersoon')" />
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
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add" />
                <span>Nieuwe categorie</span>
            </button>
        </p>

        <hr>
        <h2>Interne gegevens</h2>

        <a class="info-box selectable" href="https://stamhoofd.nolt.io/13" target="_blank">
            Wil je ook interne gegevens bijhouden die niet zichtbaar zijn voor het lid zelf (Bv. om de status van iets bij te houden)? Dat kan momenteel nog niet, maar stem zeker op deze functie als je dit wilt gebruiken: dan kunnen we hier meer prioriteit aan geven.

            <span class="button text">Stemmen</span>
        </a>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, PropertyFilterView, SaveView, STErrorsDefault, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { AskRequirement, MemberDetails, MemberDetailsWithGroups, Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, PropertyFilter, RecordCategory, Version } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager";
import EditRecordCategoryView from './records/EditRecordCategoryView.vue';
import RecordCategoryRow from "./records/RecordCategoryRow.vue";

@Component({
    components: {
        SaveView,
        STErrorsDefault,
        STList,
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

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
   
    mounted() {
        UrlHelper.setUrl("/settings/records");
    }
}
</script>
