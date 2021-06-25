<template>
    <div id="general-settings-view" class="st-view background">
        <STNavigationBar title="Instellingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Algemene instellingen
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam van je vereniging" error-fields="name" :error-box="errorBox">
                        <input
                            id="organization-name"
                            ref="firstInput"
                            v-model="name"
                            class="input"
                            type="text"
                            placeholder="De naam van je vereniging"
                            autocomplete="organization"
                        >
                    </STInputBox>

                    <AddressInput v-model="address" title="Adres van je vereniging" :validator="validator" />
                </div>

                <div>
                    <STInputBox title="Website (optioneel)" error-fields="website" :error-box="errorBox">
                        <input
                            v-model="website"
                            class="input"
                            type="url"
                            placeholder="bv. https://www.vereniging.be"
                        >
                    </STInputBox>
                    <p class="st-list-description">
                        De link naar de website van jouw vereniging. Dit is de website waar leden terecht komen als ze op 'terug naar website' klikken.
                    </p>
                </div>
            </div>
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
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { HistoryManager,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
import { Address, Organization, OrganizationPatch, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        Radio,
        BackButton,
        AddressInput,
        LoadingButton,
        IBANInput,
        ImageInput,
        ColorInput,
        FileInput
    },
})
export default class GeneralSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    showDomainSettings = true
    loadingMollie = false
    selectedPrivacyType = this.temp_organization.meta.privacyPolicyUrl ? "website" : (this.temp_organization.meta.privacyPolicyFile ? "file" : "none")

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }
   
    get name() {
        return this.organization.name
    }

    set name(name: string) {
        this.$set(this.organizationPatch, "name", name)
    }

    get website() {
        return this.organization.website ?? ""
    }

    set website(website: string) {
        this.$set(this.organizationPatch, "website", website.length == 0 ? null : website)
    }

    get address() {
        return this.organization.address
    }

    set address(address: Address) {
        this.$set(this.organizationPatch, "address", address)
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
        if (this.name.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul een geldige naam in voor je vereniging",
                field: "name"
            }))
        }

        if (this.organization.website && this.organization.website.length > 0 && !this.organization.website.startsWith("http://") && !this.organization.website.startsWith("https://")) {
            this.website = "http://"+this.organization.website
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
        HistoryManager.setUrl("/settings/general")
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>
