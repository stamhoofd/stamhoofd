<template>
    <div id="financial-support-settings-view" class="st-view background">
        <STNavigationBar title="Financiële ondersteuning">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Toestemming gegevensverzameling
            </h1>
            <p>
                Verzamel je gevoelige informatie? Dan moet je daar in de meeste gevallen toestemming voor vragen volgens de GDPR-wetgeving. We raden je aan om altijd toestemming te vragen zodra je ook maar een beetje twijfelt. In onze gids geven we enkele voorbeelden, lees die zeker na. <a href="https://www.stamhoofd.be/docs/toestemming-gegevens-verzamelen" class="inline-link" target="_blank" rel="noopener">
                    Lees onze gids
                </a>
            </p>

            <p class="info-box">
                Je kan toestemming nooit verplichten volgens de GDPR-wetgeving. Als een lid geen toestemming geeft, kan je enkel gegevens verzamelen die noodzakelijk zijn (zoals bepaald volgens de 5 verwerkingsgronden bepaald in de GDPR-wetgeving). Stamhoofd verbergt automatisch vragen waarvoor toestemming noodzakelijk is in dat geval.
            </p>

            <STErrorsDefault :error-box="errorBox" />          

            <Checkbox v-model="enableDataPermission">
                Vraag toestemming voor gegevensverzameling
            </Checkbox>

            <template v-if="enableDataPermission">
                <hr>
                <h2>Wijzig uitleg voor leden</h2>
                <p>Kies zelf de uitleg en titels die zichtbaar zijn op het moment we naar toestemming vragen</p>

                <STInputBox title="Titel" class="max">
                    <input v-model="title" class="input" :placeholder="defaultTitle">
                </STInputBox>

                <STInputBox title="Beschrijving" class="max">
                    <textarea v-model="description" class="input" placeholder="Optioneel" />
                </STInputBox>

                <STInputBox title="Tekst naast aankruisvakje" class="max">
                    <input v-model="checkboxLabel" class="input" :placeholder="defaultCheckbox">
                </STInputBox>
                <p class="style-description-small">
                    Deze tekst is zichtbaar naast het aankruisvakje (dat ze moeten aanvinken als ze de toestemming geven). 
                </p>

                <hr>
                <h2>Waarschuwing bij leden</h2>
                <p>Als een lid geen toestemming gaf, dan tonen we dit als waarschuwing als je dat lid bekijkt in Stamhoofd. Je kan zelf de tekst in deze waarschuwing wijzigen. Dit is niet zichtbaar voor de leden zelf.</p>
            
                <STInputBox title="Waarschuwingstekst" class="max">
                    <input v-model="warningText" class="input" :placeholder="defaultWarningText">
                </STInputBox>
            </template>
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
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, PriceInput,Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { DataPermissionsSettings } from '@stamhoofd/structures';
import { Organization, OrganizationMetaData, OrganizationPatch, OrganizationRecordsConfiguration, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        RadioGroup,
        Radio,
        BackButton,
        LoadingButton,
        PriceInput
    },
})
export default class DataPermissionSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get enableDataPermission() {
        return this.organization.meta.recordsConfiguration.dataPermission !== null
    }

    set enableDataPermission(enabled: boolean) {
        const hasSensitiveFields = !!this.organization.meta.recordsConfiguration.recordCategories.flatMap(r => r.getAllRecords()).find(r => r.sensitive)

        if (hasSensitiveFields && !enabled) {
            new Toast("Je hebt momenteel kenmerken van leden waarvoor toestemming vereist is. Pas die eerst aan (bij instellingen > Kenmerken en gegevens van leden)", "error red").show()
            return
        }
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    dataPermission: enabled ? (this.organization.meta.recordsConfiguration.dataPermission ?? DataPermissionsSettings.create({})) : null
                })
            })
        })
    }

    get description() {
        return this.organization.meta.recordsConfiguration.dataPermission?.description ?? ""
    }

    set description(description: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    dataPermission: DataPermissionsSettings.patch({
                        description
                    })
                })
            })
        })
    }

    get checkboxLabel() {
        return this.organization.meta.recordsConfiguration.dataPermission?.checkboxLabel ?? ""
    }

    set checkboxLabel(checkboxLabel: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    dataPermission: DataPermissionsSettings.patch({
                        checkboxLabel
                    })
                })
            })
        })
    }

    get title() {
        return this.organization.meta.recordsConfiguration.dataPermission?.title ?? ""
    }

    set title(title: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    dataPermission: DataPermissionsSettings.patch({
                        title
                    })
                })
            })
        })
    }

    get warningText() {
        return this.organization.meta.recordsConfiguration.dataPermission?.warningText ?? ""
    }

    set warningText(warningText: string) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                recordsConfiguration: OrganizationRecordsConfiguration.patch({
                    dataPermission: DataPermissionsSettings.patch({
                        warningText
                    })
                })
            })
        })
    }

    get defaultDescription() {
        return DataPermissionsSettings.defaultDescription
    }

    get defaultTitle() {
        return DataPermissionsSettings.defaultTitle
    }

    get defaultCheckbox() {
        return DataPermissionsSettings.defaultCheckboxLabel
    }

    get defaultWarningText() {
        return DataPermissionsSettings.defaultWarningText
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
        HistoryManager.setUrl("/settings/data-permission");
    }
}
</script>
