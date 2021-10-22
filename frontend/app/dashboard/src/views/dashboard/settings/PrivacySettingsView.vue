<template>
    <div class="st-view background">
        <STNavigationBar title="Privacy">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Privacy
            </h1>
            <p>
                Om in orde te zijn met de GDPR-wetgeving moet je jullie privacyvoorwaarden instellen.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Waar staan jullie privacyvoorwaarden?" error-fields="privacy" :error-box="errorBox" class="max">
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
                    placeholder="bv. https://www.vereniging.be/privacy"
                >
            </STInputBox>

            <FileInput v-if="selectedPrivacyType == 'file'" key="file" v-model="privacyPolicyFile" title="Kies een bestand" :validator="validator" :required="false" />
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, ErrorBox, FileInput,LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { File, Organization, OrganizationMetaData, OrganizationPatch, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        BackButton,
        LoadingButton,
        FileInput
    },
})
export default class PrivacySettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    selectedPrivacyType = this.temp_organization.meta.privacyPolicyUrl ? "website" : (this.temp_organization.meta.privacyPolicyFile ? "file" : "none")

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }
  
    get privacyPolicyUrl() {
        return this.organization.meta.privacyPolicyUrl
    }

    set privacyPolicyUrl(url: string | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({ }))
        }
        this.$set(this.organizationPatch.meta!, 'privacyPolicyUrl', url)
    }

    get privacyPolicyFile() {
        console.log(this.organization.meta.privacyPolicyFile)
        return this.organization.meta.privacyPolicyFile
    }

    set privacyPolicyFile(file: File | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }
        this.$set(this.organizationPatch.meta!, "privacyPolicyFile", file)
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
        UrlHelper.setUrl("/settings/privacy");
    }
}
</script>
