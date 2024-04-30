<template>
    <SaveView :loading="saving" title="Algemeen" :disabled="!hasChanges" @save="save">
        <h1>
            Algemene instellingen
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox title="Naam van je vereniging (kort)" error-fields="name" :error-box="errorBox">
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

                <AddressInput v-model="address" title="Adres van je vereniging" :validator="validator" :link-country-to-locale="true" />
            </div>

            <div>
                <UrlInput v-model="website" :title="$t('shared.inputs.url.labelOptional')" :placeholder="$t('dashboard.inputs.website.placeholder')" :validator="validator" :required="false" />

                <p class="style-description-small">
                    De link naar de website van jouw vereniging.
                </p>
            </div>
        </div>

        <hr>

        <h2>Bedrijfsinformatie (optioneel)</h2>
        <p>Om te voldoen aan sommige wettelijke verplichtingen, vul je deze informatie ook best in. Deze worden minder prominent weergegeven, maar zijn wel publiek beschikbaar.</p>

        <Checkbox v-model="hasCompanyNumber">
            Onze vereniging heeft een {{ country == 'NL' ? 'KVK-nummer' : 'ondernemingsnummer' }}
            <p class="style-description-small">
                Vink dit aan als je bent geregistreerd als {{ country != 'BE' ? 'vereniging' : 'VZW' }} of stichting
            </p>
        </Checkbox>
        <Checkbox v-if="hasCompanyNumber" v-model="hasVATNumber">
            Onze vereniging is BTW-plichtig
        </Checkbox>

        <div class="split-inputs">
            <div>
                <STInputBox :title="hasCompanyNumber ? 'Bedrijfsnaam en rechtsvorm' : 'Officiële naam vereniging'" error-fields="companyName" :error-box="errorBox">
                    <input
                        id="business-name"
                        v-model="companyName"
                        class="input"
                        type="text"
                        :placeholder="country == 'BE' ? 'bv. Ruimtereis VZW' : 'bv. Ruimtereis vereniging'"
                        autocomplete="organization"
                    >
                </STInputBox>
                <p v-if="hasCompanyNumber && country == 'BE'" class="style-description-small">
                    Vul ook de rechtsvorm in, bv. VZW.
                </p>
                <AddressInput v-if="hasCompanyNumber" v-model="companyAddress" :required="false" title="Maatschappelijke zetel" :validator="validator" />
            </div>
            <div>
                <CompanyNumberInput v-if="hasCompanyNumber && (!hasVATNumber || country != 'BE')" v-model="companyNumber" :country="country" placeholder="Jullie ondernemingsnummer" :validator="validator" :required="true" />
                <VATNumberInput v-if="hasVATNumber" v-model="VATNumber" title="BTW-nummer" placeholder="Jullie BTW-nummer" :country="country" :validator="validator" :required="true" />
            </div>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, CompanyNumberInput, DateSelection, ErrorBox, LoadingButton, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Toast, UrlInput,Validator, VATNumberInput } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Address, Country, Organization, OrganizationMetaData, OrganizationPatch, Version } from "@stamhoofd/structures";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";



@Component({
    components: {
        SaveView,
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
        VATNumberInput,
        CompanyNumberInput,
        UrlInput
    },
})
export default class GeneralSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = this.$organization
    showDomainSettings = true
    loadingMollie = false
    selectedPrivacyType = this.temp_organization.meta.privacyPolicyUrl ? "website" : (this.temp_organization.meta.privacyPolicyFile ? "file" : "none")

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: this.$organization.id })

    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }
   
    get name() {
        return this.organization.name
    }

    set name(name: string) {
        this.$set(this.organizationPatch, "name", name)
    }

    get website() {
        return this.organization.website
    }

    set website(website: string|null) {
        this.$set(this.organizationPatch, "website", website)
    }

    get address() {
        return this.organization.address
    }

    set address(address: Address) {
        this.$set(this.organizationPatch, "address", address)
    }

    get companyAddress() {
        return this.organization.meta.companyAddress
    }

    set companyAddress(companyAddress: Address | null) {
        this.organizationPatch = this.organizationPatch.patch({ 
            meta: OrganizationMetaData.patch({
                companyAddress
            })
        })
    }

    get companyName() {
        return this.organization.meta.companyName
    }

    set companyName(companyName: string | null) {
        this.organizationPatch = this.organizationPatch.patch({ 
            meta: OrganizationMetaData.patch({
                companyName
            })
        })
    }

    get VATNumber() {
        return this.organization.meta.VATNumber
    }

    set VATNumber(VATNumber: string | null) {
        this.organizationPatch = this.organizationPatch.patch({ 
            meta: OrganizationMetaData.patch({
                VATNumber,
                // VAT Number is equal to company number in Belgium, so don't ask twice
                companyNumber: this.country === Country.Belgium ? (VATNumber?.substring(2) ?? null) : undefined
            })
        })
    }

    get hasCompanyNumber() {
        return this.organization.meta.companyNumber !== null
    }

    set hasCompanyNumber(hasCompanyNumber: boolean) {
        this.organizationPatch = this.organizationPatch.patch({ 
            meta: OrganizationMetaData.patch({
                companyNumber: hasCompanyNumber ? (this.companyNumber ?? "") : null,
                VATNumber: hasCompanyNumber ? undefined : null,
                companyAddress: hasCompanyNumber ? (this.companyAddress ?? this.address) : null,
            })
        })
    }

    get hasVATNumber() {
        return this.organization.meta.VATNumber !== null
    }

    set hasVATNumber(hasVATNumber: boolean) {
        this.organizationPatch = this.organizationPatch.patch({ 
            meta: OrganizationMetaData.patch({
                VATNumber: hasVATNumber ? (this.VATNumber ?? "") : null
            })
        })
    }

    get companyNumber() {
        return this.organization.meta.companyNumber
    }

    set companyNumber(companyNumber: string | null) {
        this.organizationPatch = this.organizationPatch.patch({ 
            meta: OrganizationMetaData.patch({
                companyNumber
            })
        })
    }

    get country() {
        return this.companyAddress?.country ?? this.address.country
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
        return patchContainsChanges(this.organizationPatch, this.$organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    mounted() {
        UrlHelper.setUrl("/settings/general")
    }
}
</script>