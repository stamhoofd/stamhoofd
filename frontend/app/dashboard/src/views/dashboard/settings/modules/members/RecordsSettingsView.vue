<template>
    <SaveView :loading="saving" title="Vragenlijsten en gegevens van leden" :disabled="!hasChanges" @save="save">
        <h1>
            Vragenlijsten en gegevens van leden
        </h1>
        <p>Je kan zelf kiezen welke extra informatie je van jouw leden wilt verzamelen. Stamhoofd heeft enkele ingebouwde zaken, maar je kan de informatie die je wilt verzamelen zo veel uitbreiden als je wilt.</p>
            
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>Ingebouwde gegevens</h2>

        <p>Bepaalde gegevens zijn ingebouwd in Stamhoofd zodat we die ook op een speciale manier kunnen verwerken. Je kan deze hier aan of uit zetten, en eventueel bepaalde gegevens optioneel maken (altijd of bijvoorbeeld op basis van de leeftijd).</p>

        <p v-if="!getEnableFilterConfiguration('emailAddress') && !getEnableFilterConfiguration('parents')" class="error-box">
            Je moet minstens het e-mailadres van een lid of de gegevens van ouders verzamelen. Je kan niet beide uitschakelen.
        </p>

        <STList>
            <STListItem>
                <Checkbox #left :checked="getEnableFilterConfiguration('phone')" @change="setEnableFilterConfiguration('phone', $event)" />
                <p class="style-title-list">
                    {{ $t('shared.inputs.mobile.label') }} (van lid zelf)
                </p>
                <p v-if="getEnableFilterConfiguration('phone')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.phone.getString(getFilterDefinitionsForProperty('phone')) }}
                </p>
                <template v-if="getEnableFilterConfiguration('phone')" #right><button class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('phone', $t('shared.inputs.mobile.label'))" /></template>
            </STListItem>
            <STListItem>
                <Checkbox #left :checked="getEnableFilterConfiguration('emailAddress')" @change="setEnableFilterConfiguration('emailAddress', $event)" />
                <p class="style-title-list">
                    E-mailadres (van lid zelf)
                </p>
                <p v-if="getEnableFilterConfiguration('emailAddress')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.emailAddress.getString(getFilterDefinitionsForProperty('emailAddress')) }}
                </p>
                <template v-if="getEnableFilterConfiguration('emailAddress')" #right><button class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('emailAddress', 'E-mailadres')" /></template>
            </STListItem>
            <STListItem>
                <Checkbox #left :checked="getEnableFilterConfiguration('gender')" @change="setEnableFilterConfiguration('gender', $event)" />
                <p class="style-title-list">
                    Geslacht
                </p>
                <p v-if="getEnableFilterConfiguration('gender')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.gender.getString(getFilterDefinitionsForProperty('gender')) }}
                </p>
                <template v-if="getEnableFilterConfiguration('gender')" #right><button class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('gender', 'Geslacht')" /></template>
            </STListItem>
            <STListItem>
                <Checkbox #left :checked="getEnableFilterConfiguration('birthDay')" @change="setEnableFilterConfiguration('birthDay', $event)" />
                <p class="style-title-list">
                    Geboortedatum
                </p>
                <p v-if="getEnableFilterConfiguration('birthDay')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.birthDay.getString(getFilterDefinitionsForProperty('birthDay')) }}
                </p>
                <template v-if="getEnableFilterConfiguration('birthDay')" #right><button class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('birthDay', 'Geboortedatum')" /></template>
            </STListItem>
            <STListItem>
                <Checkbox #left :checked="getEnableFilterConfiguration('address')" @change="setEnableFilterConfiguration('address', $event)" />
                <p class="style-title-list">
                    Adres (van lid zelf)
                </p>
                <p v-if="getEnableFilterConfiguration('address')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.address.getString(getFilterDefinitionsForProperty('address')) }}
                </p>
                <template v-if="getEnableFilterConfiguration('address')" #right><button class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('address', 'Adres')" /></template>
            </STListItem>
            <STListItem>
                <Checkbox #left :checked="getEnableFilterConfiguration('parents')" @change="setEnableFilterConfiguration('parents', $event)" />
                <p class="style-title-list">
                    Ouders
                </p>
                <p v-if="getEnableFilterConfiguration('parents')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.parents.getString(getFilterDefinitionsForProperty('parents')) }}
                </p>
                <template v-if="getEnableFilterConfiguration('parents')" #right><button class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('parents', 'Ouders')" /></template>
            </STListItem>
            <STListItem>
                <Checkbox #left :checked="getEnableFilterConfiguration('emergencyContacts')" @change="setEnableFilterConfiguration('emergencyContacts', $event)" />
                <p class="style-title-list">
                    Noodcontactpersoon
                </p>
                <p v-if="getEnableFilterConfiguration('emergencyContacts')" class="style-description-small">
                    {{ patchedOrganization.meta.recordsConfiguration.emergencyContacts.getString(getFilterDefinitionsForProperty('emergencyContacts')) }}
                </p>
                <template v-if="getEnableFilterConfiguration('emergencyContacts')" #right><button class="button gray icon settings" type="button" @click="editEnableFilterConfiguration('emergencyContacts', 'Noodcontactpersoon')" /></template>
            </STListItem>
        </STList>

        <hr>
        <h2>Vragenlijsten tijdens inschrijven</h2>

        <p>
            Voeg zelf vragenlijsten toe die ingevuld kunnen worden bij het inschrijven. <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">Meer info</a>
        </p>

        <STList v-model="categories" :draggable="true">
            <RecordCategoryRow v-for="category in categories" :key="category.id" :category="category" :categories="categories" :selectable="true" :settings="editorSettings" @patch="addCategoriesPatch" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add" />
                <span>Nieuwe vragenlijst</span>
            </button>
        </p>

        <!--<hr>
        <h2>Templates</h2>

        <p>
            Het instellen van vragenlijsten kan soms complex zijn. Daarom voorzien we enkele templates die je kan gebruiken en waarmee je meteen een werkende vragenlijst kan toevoegen.
        </p>-->

        <hr>
        <h2>Interne gegevens</h2>

        <a class="info-box selectable" href="https://feedback.stamhoofd.app/13" target="_blank">
            Wil je ook interne gegevens bijhouden die niet zichtbaar zijn voor het lid zelf (Bv. om de status van iets bij te houden)? Dat kan momenteel nog niet, maar stem zeker op deze functie als je dit wilt gebruiken: dan kunnen we hier meer prioriteit aan geven.

            <span class="button text">Stemmen</span>
        </a>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, PropertyFilterView, SaveView, STErrorsDefault, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { AskRequirement, MemberDetails, MemberDetailsWithGroups, Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, PropertyFilter, RecordAnswer, RecordCategory, RecordEditorSettings, Version } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";


import EditRecordCategoryQuestionsView from './records/EditRecordCategoryQuestionsView.vue';
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

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: this.$organization.id })

    get AskRequirement() {
        return AskRequirement
    }

    get organization() {
        return this.$organization
    }

    get patchedOrganization() {
        return this.organization.patch(this.organizationPatch)
    }

    get categories() {
        return this.patchedOrganization.meta.recordsConfiguration.recordCategories
    }

    set categories(categories: RecordCategory[]) {
        const p = OrganizationRecordsConfiguration.patch({
            recordCategories: categories as any
        })
        this.addRecordsConfigurationPatch(p)
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

    get editorSettings() {
        return new RecordEditorSettings({
            dataPermission: true,
            filterDefinitions: (categories: RecordCategory[]) => {
                return [
                    ...MemberDetailsWithGroups.getBaseFilterDefinitions(),
                    ...RecordCategory.getRecordCategoryDefinitions(categories, (member: MemberDetailsWithGroups) => {
                        return member.details.recordAnswers
                    }),
                ]
            },
            filterValueForAnswers: (recordAnswers: RecordAnswer[]) => new MemberDetailsWithGroups(MemberDetails.create({recordAnswers}), undefined, [])
        })
    }

    get filterDefinitions() {
        return MemberDetailsWithGroups.getFilterDefinitions(this.patchedOrganization, {});
    }

    addCategory() {
        const category = RecordCategory.create({})

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditRecordCategoryView, {
                        category,
                        isNew: true,
                        filterDefinitions: this.filterDefinitions,
                        saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>, component: NavigationMixin) => {
                            this.addCategoriesPatch(patch)
                            component.show({
                                components: [
                                    new ComponentWithProperties(EditRecordCategoryQuestionsView, {
                                        categoryId: category.id,
                                        rootCategories: this.categories,
                                        settings: this.editorSettings,
                                        isNew: false,
                                        saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                                            this.addCategoriesPatch(patch)
                                        }
                                    })
                                ],
                                replace: 1,
                                force: true
                            })
                        }
                    })
                })
            ],
            modalDisplayStyle: "popup"
        })
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
                this.organization.meta.recordsConfiguration[property] ?? def[property] ?? PropertyFilter.createDefault()
            )
        } else {
            this.patchConfigProperty(property, null)
        }
    }

    getFilterDefinitionsForProperty(property: string) {
        if (['parents', 'emergencyContacts'].includes(property)) {
            return MemberDetailsWithGroups.getBaseFilterDefinitions()
        }
        return MemberDetails.getBaseFilterDefinitions()
    }

    editEnableFilterConfiguration(property: string, title: string) {
        this.present(new ComponentWithProperties(PropertyFilterView, {
            configuration: this.patchedOrganization.meta.recordsConfiguration[property],
            title,
            organization: this.patchedOrganization,
            definitions: this.getFilterDefinitionsForProperty(property),
            setConfiguration: (configuration: PropertyFilter<MemberDetails | MemberDetailsWithGroups>) => {
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

        if (!this.getEnableFilterConfiguration('emailAddress') && !this.getEnableFilterConfiguration('parents')) {
            valid = false;
        }

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            await this.$organizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id })
            new Toast('De wijzigingen zijn opgeslagen', "success green").show()
            this.dismiss({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, this.$organization, { version: Version })
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
