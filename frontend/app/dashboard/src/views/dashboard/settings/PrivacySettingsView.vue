<template>
    <SaveView :loading="saving" title="Privacy" :disabled="!hasChanges" @save="save">
        <h1>
            Privacy
        </h1>
        <p>
            Om in orde te zijn met de GDPR-wetgeving moet je jullie privacyvoorwaarden instellen.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Waar staan de privacyvoorwaarden?" error-fields="privacy" :error-box="errorBox" class="max">
            <RadioGroup>
                <Radio v-model="selectedPrivacyType" value="none">
                    Geen
                </Radio>
                <Radio v-model="selectedPrivacyType" value="website">
                    Op onze website
                </Radio>
                <Radio v-model="selectedPrivacyType" value="file">
                    Zelf PDF-bestand aanleveren
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedPrivacyType == 'website'" key="website" title="Volledige link naar privacyvoorwaarden" error-fields="privacyPolicyUrl" :error-box="errorBox">
            <input
                v-model="privacyPolicyUrl"
                class="input"
                type="url"
                :placeholder="$t('dashboard.inputs.privacyUrl.placeholder')"
            >
        </STInputBox>

        <FileInput v-if="selectedPrivacyType == 'file'" key="file" v-model="privacyPolicyFile" title="Kies een bestand" :validator="validator" :required="false" />
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { CenteredMessage, ErrorBox, FileInput, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, Toast, Validator } from "@stamhoofd/components";
import { File, Organization, OrganizationMetaData, OrganizationPatch, Version } from "@stamhoofd/structures";



@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        FileInput
    },
})
export default class PrivacySettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    // Keep track of selected option
    defaultSelectedType = 'none'
    selectedPrivacyType = 'none'

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({})


    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get privacyPolicyUrl() {
        return this.organization.meta.privacyPolicyUrl
    }

    set privacyPolicyUrl(url: string | null) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                privacyPolicyUrl: url
            })
        })
    }

    get privacyPolicyFile() {
        return this.organization.meta.privacyPolicyFile
    }

    set privacyPolicyFile(file: File | null) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                privacyPolicyFile: file
            })
        })
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
       
        if (this.selectedPrivacyType == "none") {
            this.privacyPolicyFile = null;
            this.privacyPolicyUrl = null;
        } else if (this.selectedPrivacyType == "file") {
            this.privacyPolicyUrl = null;
            // We don't clear the file if url is selected, since url has priority over the file. So we don't need to reupload the file
        }

        if (this.selectedPrivacyType == "website" && this.organization.meta.privacyPolicyUrl && this.organization.meta.privacyPolicyUrl.length > 0 && !this.organization.meta.privacyPolicyUrl.startsWith("http://") && !this.organization.meta.privacyPolicyUrl.startsWith("https://")) {
            this.privacyPolicyUrl = "http://"+this.organization.meta.privacyPolicyUrl
        }

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
        return this.selectedPrivacyType !== this.defaultSelectedType || patchContainsChanges(this.organizationPatch, this.$organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    mounted() {
        this.defaultSelectedType = this.$organization.meta.privacyPolicyUrl ? "website" : (this.$organization.meta.privacyPolicyFile ? "file" : "none")
        this.selectedPrivacyType = this.defaultSelectedType

        this.organizationPatch.id = this.$organization.id
        this.setUrl("/privacy");
    }
}
</script>
