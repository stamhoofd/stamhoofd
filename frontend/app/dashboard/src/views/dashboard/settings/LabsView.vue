<template>
    <SaveView :loading="saving" title="Experimenten" :disabled="!hasChanges" @save="save">
        <h1>
            Experimenten
        </h1>

        <p>Hier kan je functies aanzetten die we nog aan het uittesten zijn, of functies die enkel voor geavanceerdere gebruikers nodig zijn.</p>
        
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>Ontwikkelaars</h2>

        <STList class="illustration-list">    
            <STListItem :selectable="true" class="left-center" @click="openApiUsers(true)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/laptop.svg">
                <h2 class="style-title-list">
                    API-keys
                </h2>
                <p class="style-description">
                    Maak API-keys aan om toegang te krijgen tot de Stamhoofd-API.
                </p>
                <span slot="right" class="icon arrow-right-small gray" />
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="downloadSettings(true)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/box-download.svg">
                <h2 class="style-title-list">
                    Exporteer instellingen
                </h2>
                <p class="style-description">
                    Maak een kopie van de instellingen van jouw vereniging.
                </p>
                <LoadingButton slot="right" :loading="downloadingSettings">
                    <span class="icon download gray" />
                </LoadingButton>
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="uploadSettings(true)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/box-upload.svg">
                <h2 class="style-title-list">
                    Importeer instellingen
                </h2>
                <p class="style-description">
                    Overschrijf alle instellingen.
                </p>
                <LoadingButton slot="right" :loading="uploadingSettings">
                    <span class="icon upload gray" />
                </LoadingButton>
            </STListItem>
        </STList>

        <hr>
        <h2>Geavanceerde instellingen</h2>

        <Checkbox v-if="!enableBuckaroo" key="mollie" v-model="forceMollie">
            Mollie (betaalprovider)
        </Checkbox>
        <p class="style-description-small">
            Hou er rekening mee dat de tarieven van Mollie hoger liggen dan degene die Stamhoofd bij Stripe aanbiedt. <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/transactiekosten/'" class="inline-link" target="_blank">Meer info</a>
        </p>

        <div v-if="isStamhoofd" key="stamhoofd-settings" class="container">
            <hr>
            <h2>
                Instellingen beheerd door Stamhoofd
            </h2>

            <Checkbox v-model="useTestPayments">
                Activeer test-modus voor betalingen
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('stamhoofd-pay-by-transfer')" @change="setFeatureFlag('stamhoofd-pay-by-transfer', !!$event)">
                Stamhoofd betalen via overschrijving
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('stamhoofd-pay-by-saved')" @change="setFeatureFlag('stamhoofd-pay-by-saved', !!$event)">
                Stamhoofd betalen via opgeslagen betaalmethode
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('sso')" @change="setFeatureFlag('sso', !!$event)">
                Single-Sign-On
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('webshop-auth')" @change="setFeatureFlag('webshop-auth', !!$event)">
                Webshop auth
            </Checkbox>

            <hr>

            <button class="button text" type="button" @click="applyDiscountCode">
                <span class="icon gift" /><span>Kortingscode toepassen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, ObjectData, patchContainsChanges, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, InputSheet, LoadingButton, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Country, Organization, OrganizationMetaData, OrganizationPatch, OrganizationPrivateMetaData, PrivatePaymentConfiguration, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import ApiUsersView from '../admins/ApiUsersView.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        Checkbox,
        LoadingButton
    },
})
export default class LabsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    downloadingSettings = false
    uploadingSettings = false
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    openApiUsers(animated = true) {
        this.show({
            components: [
                new ComponentWithProperties(ApiUsersView, {})
            ],
            animated
        })
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get isStamhoofd() {
        return OrganizationManager.user.email.endsWith("@stamhoofd.be") || OrganizationManager.user.email.endsWith("@stamhoofd.nl")
    }

    get enableBuckaroo() {
        return (this.organization.privateMeta?.buckarooSettings ?? null) !== null
    }

    get forceMollie() {
        return this.organization.privateMeta?.featureFlags.includes('forceMollie') ?? false
    }

    set forceMollie(forceMollie: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== 'forceMollie') ?? []
        if (forceMollie) {
            featureFlags.push('forceMollie')
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta:  OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any
            })
        })
    }

    get forcePayconiq() {
        return this.getFeatureFlag('forcePayconiq')
    }

    set forcePayconiq(forcePayconiq: boolean) {
        this.setFeatureFlag('forcePayconiq', forcePayconiq)
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    setFeatureFlag(flag: string, value: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== flag) ?? []
        if (value) {
            featureFlags.push(flag)
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta:  OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any
            })
        })
    }

    get useTestPayments() {
        return this.organization.privateMeta?.useTestPayments ?? STAMHOOFD.environment != 'production'
    }

    set useTestPayments(useTestPayments: boolean) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                // Only save non default value
                useTestPayments: STAMHOOFD.environment != 'production' === useTestPayments ? null : useTestPayments
            })
        })
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
        // We can clear now
        UrlHelper.shared.clear()
        UrlHelper.setUrl("/settings/labs")
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

    downloadSettings() {
        if (this.downloadingSettings) {
            return
        }

        // Remove private data
        const organization = Organization.create({
            ...OrganizationManager.organization,
            admins: [],
            webshops: []
        });

        // Delete private tokens
        organization.privateMeta!.payconiqAccounts = []
        organization.privateMeta!.buckarooSettings = null
        organization.privateMeta!.mollieProfile = null
        organization.privateMeta!.registrationPaymentConfiguration = PrivatePaymentConfiguration.create({})
        

        const versionBox = new VersionBox(organization)
        
        // Create a clean JSON file
        const string = JSON.stringify(versionBox.encode({version: Version}), null, 2);

        // Create a blob
        const blob = new Blob([string], { type: 'application/json' });

        // Trigger a download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = Formatter.fileSlug(this.organization.name) + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    uploadSettings() {
        // Trigger a file input of a file with type .json
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event: any) => {
            if (!event || !event.target || !event.target.files || event.target.files.length != 1) {
                return;
            }
            const file = event.target.files[0] as File;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const data = event.target!.result as string;
                try {
                    this.uploadingSettings = true;
                    const parsed = JSON.parse(data);

                    try {
                        await this.doUploadSettings(parsed);
                        new Toast('De instellingen zijn geïmporteerd', "success green").show()
                    } catch (e) {
                        Toast.fromError(e).show()
                    }
                } catch (e) {
                    Toast.fromError(new SimpleError({
                        code: 'invalid_json',
                        message: 'Het bestand is geen geldig JSON-bestand'
                    })).show()
                }
                this.uploadingSettings = false;
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async doUploadSettings(blob: any) {
        // Decode
        let organization: Organization;
        try {
            const decodedOrganization = new VersionBoxDecoder(Organization as Decoder<Organization>).decode(new ObjectData(blob, {version: 0}));
            organization = decodedOrganization.data
        } catch (e) {
            throw new SimpleError({
                code: 'invalid_json',
                message: 'Het bestand is geen geldige export: ' + e.getMessage()
            })
        }

        const existing = OrganizationManager.organization;

        const privatePatch = OrganizationPrivateMetaData.patch({});
        
        // Add emails
        for (const email of organization.privateMeta?.emails ?? []) {
            if (!existing.privateMeta?.emails.find(e => e.email === email.email)) {
                // Only add if it doesn't exist yet
                privatePatch.emails.addPut(email)
            }
        }

        // Add roles
        for (const role of organization.privateMeta?.roles ?? []) {
            if (!existing.privateMeta?.roles.find(r => r.id === role.id)) {
                // Only add if it doesn't exist yet
                privatePatch.roles.addPut(role)
            }
        }

        // Add featureFlags
        for (const featureFlag of organization.privateMeta?.featureFlags ?? []) {
            if (!existing.privateMeta?.featureFlags.includes(featureFlag)) {
                // Only add if it doesn't exist yet
                privatePatch.featureFlags.addPut(featureFlag)
            }
        }

        const meta = {
            ...organization.meta,
        } as any;
        delete meta.registrationPaymentConfiguration;
        
        const organizationPatch = Organization.patch({
            id: existing.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            meta: OrganizationMetaData.patch(meta),
            privateMeta: privatePatch,
            name: organization.name,
            address: organization.address,
            website: organization.website,
            uri: organization.uri,
        })

        // Copy over groups
        for (const group of organization.groups) {
            if (!existing.groups.find(g => g.id === group.id)) {
                // Only add if it doesn't exist yet
                organizationPatch.groups.addPut(group)
            }
        }

        // Send to server
        await OrganizationManager.patch(organizationPatch)
    }

    applyDiscountCode() {
        this.present({
            components: [
                new ComponentWithProperties(InputSheet, {
                    title: 'Kortingscode toepassen',
                    description: 'De kortingscode zal meteen worden toegepast op deze vereniging. De andere vereniging ontvangt een e-mail dat de kortingscode is gebruikt, en zal meteen tegoed ontvangen als de vereniging al een betalende klant is (in het andere geval pas later).',
                    placeholder: 'Vul hier de code in',
                    saveHandler: async (code: string) => {
                        await SessionManager.currentSession!.authenticatedServer.request({
                            method: 'POST',
                            path: '/organization/register-code',
                            body: {
                                registerCode: code
                            }
                        })
                        new Toast('De kortingscode is toegepast', "success green").show()
                    }   
                })
            ],
            modalDisplayStyle: 'sheet'
        })
    }

}
</script>