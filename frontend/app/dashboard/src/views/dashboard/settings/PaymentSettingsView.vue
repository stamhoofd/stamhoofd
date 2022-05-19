<template>
    <SaveView :loading="saving" title="Betaalmethodes" :disabled="!hasChanges" @save="save">
        <h1>
            Betaalmethodes
        </h1>

        <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/online-betalen'" target="_blank">deze pagina</a>.</p>
        
        <STErrorsDefault :error-box="errorBox" />

        <template v-if="enableMemberModule">
            <hr>
            <h2>Betaalmethodes voor inschrijvingen</h2>

            <EditPaymentMethodsBox :methods="organization.meta.paymentMethods" :organization="organization" @patch="patchPaymentMethods" />

            <hr>
        </template>

        <h2>Overschrijvingen</h2>

        <IBANInput v-model="iban" title="Bankrekeningnummer" :validator="validator" :required="false" />

        <template v-if="enableMemberModule">
            <hr>
            <h2>Overschrijvingen, specifiek voor inschrijvingen</h2>

            <STInputBox title="Begunstigde" error-fields="transferSettings.creditor" :error-box="errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    :placeholder="organization.name"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Soort mededeling" error-fields="transferSettings.type" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-for="_type in transferTypes" :key="_type.value" v-model="transferType" :value="_type.value">
                        {{ _type.name }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
            <p class="style-description-small">
                {{ transferTypeDescription }}
            </p>

            <STInputBox v-if="transferType != 'Structured'" :title="transferType == 'Fixed' ? 'Mededeling' : 'Voorvoegsel'" error-fields="transferSettings.prefix" :error-box="errorBox">
                <input
                    v-model="prefix"
                    class="input"
                    type="text"
                    placeholder="bv. Inschrijving"
                    autocomplete=""
                >
            </STInputBox>
            <p class="style-description-small">
                Voorbeeld: “{{ transferExample }}”
            </p>
        </template>

        <hr>
        <h2>
            Online betalingen activeren
        </h2>

        <p v-if="isBuckarooActive" class="success-box">
            Online betalingen zijn geactiveerd voor de volgende betaalmethodes: {{ buckarooPaymentMethodsString }}
        </p>

        <p class="st-list-description">
            {{ $t('dashboard.settings.paymentMethods.buckaroo.description') }}
        </p>

        <p>
            <a class="button text" :href="'https://'+$t('shared.domains.marketing')+'/docs/aansluiten-bij-buckaroo'" target="_blank">
                <span>Aansluiten</span>
                <span class="icon arrow-right" />
            </a>
        </p>

        <template v-if="payconiqApiKey || forcePayconiq">
            <hr>
            <h2>Online betalingen via Payconiq</h2>
            <p class="st-list-description">
                Vul hieronder jouw API-key in om betalingen rechtstreeks via Payconiq te verwerken.
            </p>

            <STInputBox title="API-key" error-fields="payconiqApiKey" :error-box="errorBox" class="max">
                <input
                    v-model="payconiqApiKey"
                    class="input"
                    type="text"
                    placeholder="API-key van Payconiq"
                >
            </STInputBox>
        </template>

        <template v-if="!enableBuckaroo && (organization.privateMeta.mollieOnboarding || forceMollie)">
            <hr>
            <h2>
                Online betalingen via Mollie
            </h2>

            <template v-if="!organization.privateMeta.mollieOnboarding">
                <p class="st-list-description">
                    {{ $t('dashboard.settings.paymentMethods.mollie.description') }}
                </p>
                <p v-if="isBelgium" class="info-box">
                    Voor Mollie heb je een VZW nodig. Een feitelijke vereniging is niet voldoende (wordt niet geaccepteerd)
                </p>

                <p class="st-list-description">
                    <button class="button text" type="button" @click="linkMollie">
                        <span class="icon link" />
                        <span>Mollie koppelen</span>
                    </button>
                </p>
            </template>
            <template v-else>
                <p v-if="organization.privateMeta.mollieOnboarding.canReceivePayments" class="success-box">
                    {{ $t('dashboard.settings.paymentMethods.mollie.activeDescription') }}
                </p>
                <p v-else class="warning-box">
                    Je kan nog geen betalingen verwerken omdat je eerst meer gegevens moet aanvullen.
                </p>
                <p v-if="!organization.privateMeta.mollieOnboarding.canReceiveSettlements" class="warning-box">
                    Als je uitbetalingen wil ontvangen moet je eerst jouw gegevens verder aanvullen
                </p>

                <p v-if="organization.privateMeta.mollieOnboarding.status == 'NeedsData'" class="st-list-description">
                    Mollie is gekoppeld, maar je moet nog enkele gegevens aanvullen.
                </p>
                <p v-if="organization.privateMeta.mollieOnboarding.status == 'InReview'" class="st-list-description">
                    Jouw gegevens worden nagekeken door onze betaalpartner (Mollie).
                </p>

                <p class="st-list-description">
                    <LoadingButton :loading="loadingMollie">
                        <button class="button text" type="button" @click="mollieDashboard">
                            <span class="icon external" />
                            <span>Ga naar het Mollie dashboard</span>
                        </button>
                    </loadingbutton>
                </p>
                <p class="st-list-description">
                    <button class="button text" type="button" @click="disconnectMollie">
                        <span class="icon trash" />
                        <span>Account loskoppelen van Stamhoofd</span>
                    </button>
                </p>
            </template>
        </template>

        <template v-if="isStamhoofd">
            <hr>
            <h2>
                Instellingen beheerd door Stamhoofd
            </h2>

            <Checkbox v-model="useTestPayments">
                Activeer test-modus voor betalingen
            </Checkbox>

            <Checkbox v-model="enableBuckaroo">
                Gebruik Buckaroo voor online betalingen
            </Checkbox>

            <Checkbox v-model="forcePayconiq">
                Payconiq koppeling toestaan
            </Checkbox>

            <Checkbox v-if="!enableBuckaroo" v-model="forceMollie">
                Mollie koppeling toestaan
            </Checkbox>

            <div v-if="enableBuckaroo" class="split-inputs">
                <div>
                    <STInputBox title="Key" error-fields="buckarooSettings.key" :error-box="errorBox" class="max">
                        <input
                            v-model="buckarooKey"
                            class="input"
                            type="text"
                            placeholder="Key"
                        >
                    </STInputBox>
                    <p class="style-description-small">
                        Buckaroo Plaza > Mijn Buckaroo > Websites > Algemeen > Key
                    </p>
                </div>
                <div>
                    <STInputBox title="Secret" error-fields="buckarooSettings.secret" :error-box="errorBox" class="max">
                        <input
                            v-model="buckarooSecret"
                            class="input"
                            type="text"
                            placeholder="Secret"
                        >
                    </STInputBox>
                    <p class="style-description-small">
                        Buckaroo Plaza > Configuratie > Beveiliging > Secret Key
                    </p>
                </div>
            </div>

            <EditPaymentMethodsBox v-if="enableBuckaroo" :methods="buckarooPaymentMethods" :organization="organization" :show-prices="false" :choices="buckarooAvailableMethods" @patch="patchBuckarooPaymentMethods" />
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, PatchableArray, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, IBANInput, LoadingButton, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { AppManager, SessionManager, Storage, UrlHelper } from '@stamhoofd/networking';
import { BuckarooSettings, Country, Organization, OrganizationMetaData, OrganizationPatch, OrganizationPrivateMetaData, PaymentMethod, TransferDescriptionType, TransferSettings, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import EditPaymentMethodsBox from '../../../components/EditPaymentMethodsBox.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        RadioGroup,
        Radio,
        LoadingButton,
        IBANInput,
        STList,
        STListItem,
        Checkbox,
        EditPaymentMethodsBox
    },
})
export default class PaymentSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    loadingMollie = false

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get isStamhoofd() {
        return OrganizationManager.user.email.endsWith("@stamhoofd.be")
    }

    patchPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.organizationPatch = this.organizationPatch.patch({
            meta: OrganizationMetaData.patch({
                paymentMethods: patch
            })
        })
    }

    patchBuckarooPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    paymentMethods: patch
                })
            })
        })
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get transferTypes() {
        return [
            { 
                value: TransferDescriptionType.Structured,
                name: this.$t('shared.transferTypes.structured'),
                description: "Willekeurig aangemaakt. Geen kans op typefouten vanwege validatie in bankapps."
            },
            { 
                value: TransferDescriptionType.Reference,
                name: "Naam van lid/leden",
                description: "Eventueel voorafgegaan door een zelf gekozen woord (zie onder)"
            },
            { 
                value: TransferDescriptionType.Fixed,
                name: "Vaste mededeling",
                description: "Altijd dezelfde mededeling voor alle inschrijvingen. Opgelet: dit kan niet gewijzigd worden als leden de QR-code scannen, voorzie dus zelf geen eigen vervangingen zoals 'inschrijving + naam'!"
            }
        ]
    }

    get transferTypeDescription() {
        return this.transferTypes.find(t => t.value === this.transferType)?.description ?? ""
    }

    get creditor() {
        return this.organization.meta.transferSettings.creditor
    }

    set creditor(creditor: string | null ) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "creditor", creditor ? creditor : null)
    }

    preparePatchTransferSettings() {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }
        if (!this.organizationPatch.meta!.transferSettings) {
            this.$set(this.organizationPatch.meta!, "transferSettings", TransferSettings.patch({}))
        }
    }

    get iban() {
        return this.organization.meta.transferSettings.iban ?? ""
    }

    set iban(iban: string) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "iban", iban ? iban : null)
    }

    get prefix() {
        return this.organization.meta.transferSettings.prefix
    }

    set prefix(prefix: string | null ) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "prefix", prefix ? prefix : null)
    }

    get transferType() {
        return this.organization.meta.transferSettings.type
    }

    set transferType(type: TransferDescriptionType ) {
        this.preparePatchTransferSettings()
        this.$set(this.organizationPatch.meta!.transferSettings!, "type", type)
    }

    get transferExample() {
        if (this.transferType == TransferDescriptionType.Structured) {
            if (!this.isBelgium) {
                return "4974 3024 6755 6964"
            }
            return "+++705/1929/77391+++"
        }

        if (this.transferType == TransferDescriptionType.Reference) {
            return (this.prefix ? this.prefix+' ' : '') + "Simon en Andreas Backx"
        }

        return this.prefix
    }

    get payconiqApiKey() {
        return this.organization.privateMeta?.payconiqApiKey ?? ""
    }

    set payconiqApiKey(payconiqApiKey: string) {
        if (this.payconiqApiKey && payconiqApiKey.length == 0) {
            this.forcePayconiq = true;
        }

        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                payconiqApiKey: payconiqApiKey.length == 0 ? null : payconiqApiKey
            })
        })
    }

    get enableBuckaroo() {
        return (this.organization.privateMeta?.buckarooSettings ?? null) !== null
    }

    set enableBuckaroo(enable: boolean) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: enable ? BuckarooSettings.create({}) : null
            })
        })
    }

    get buckarooKey() {
        return this.organization.privateMeta?.buckarooSettings?.key ?? ""
    }

    set buckarooKey(key: string) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    key
                })
            })
        })
    }

    get buckarooSecret() {
        return this.organization.privateMeta?.buckarooSettings?.secret ?? ""
    }

    set buckarooSecret(secret: string) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    secret
                })
            })
        })
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
        return this.organization.privateMeta?.featureFlags.includes('forcePayconiq') ?? false
    }

    set forcePayconiq(forcePayconiq: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== 'forcePayconiq') ?? []
        if (forcePayconiq) {
            featureFlags.push('forcePayconiq')
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta:  OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any
            })
        })
    }

    get payconiqActive() {
        return (OrganizationManager.organization.privateMeta?.payconiqApiKey ?? "").length > 0
    }

    get isBuckarooActive() {
        return this.enableBuckaroo && (OrganizationManager.organization.privateMeta?.buckarooSettings?.key ?? "").length > 0 && (OrganizationManager.organization.privateMeta?.buckarooSettings?.secret ?? "").length > 0
    }

    get buckarooPaymentMethodsString() {
        let methods = this.buckarooPaymentMethods

        if (this.payconiqActive) {
            // Remove Payconiq if has direct link
            methods = methods.filter(m => m !== PaymentMethod.Payconiq)
        }
        return Formatter.joinLast(methods, ", ", " en ")
    }

    get buckarooPaymentMethods() {
        return this.organization.privateMeta?.buckarooSettings?.paymentMethods ?? []
    }

    get buckarooAvailableMethods() {
        return [PaymentMethod.Bancontact, PaymentMethod.CreditCard, PaymentMethod.iDEAL, PaymentMethod.Payconiq]
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


    async linkMollie() {
        // Start oauth flow
        const client_id = STAMHOOFD.MOLLIE_CLIENT_ID
        if (!client_id) {
            new Toast("Mollie wordt momenteel niet ondersteund. Probeer later opnieuw.", "error red").show()
            return
        }
        const state = Buffer.from(crypto.getRandomValues(new Uint32Array(16))).toString('base64');
        await Storage.keyValue.setItem("mollie-saved-state", state)

        const scope = "payments.read payments.write refunds.read refunds.write organizations.read organizations.write onboarding.read onboarding.write profiles.read profiles.write subscriptions.read subscriptions.write mandates.read mandates.write settlements.read orders.read orders.write"
        const url = "https://www.mollie.com/oauth2/authorize?client_id="+encodeURIComponent(client_id)+"&state="+encodeURIComponent(state)+"&scope="+encodeURIComponent(scope)+"&response_type=code&approval_prompt=force&locale=nl_BE"

        window.location.href = url;
    }

    async disconnectMollie() {
        if (await CenteredMessage.confirm("Ben je zeker dat je Mollie wilt loskoppelen?", "Ja, loskoppelen", "Jouw Mollie account blijft behouden en kan je later terug koppelen als je dat wilt.")) {
            try {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/mollie/disconnect",
                    decoder: Organization as Decoder<Organization>
                })

                SessionManager.currentSession!.setOrganization(response.data)
                new Toast("Mollie is losgekoppeld", "success green").show()
            } catch (e) {
                new Toast("Loskoppelen mislukt", "error red").show()
            }
        }
    }

    async doLinkMollie(code: string, state: string) {
        const toast = new Toast("Koppelen...", "spinner").setHide(null).show()

        try {
            const savedState = await Storage.keyValue.getItem("mollie-saved-state")
            if (savedState !== state) {
                throw new SimpleError({
                    code: "state_verification_failed",
                    message: "State is not the same",
                    human: "Er ging iets mis bij het koppelen. Een onbekende pagina probeerde Mollie te koppelen. Contacteer ons via "+this.$t('shared.emails.general')+" als je Mollie probeert te koppelen en het blijft mislukken."
                })
            }
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/mollie/connect",
                body: {
                    code
                },
                decoder: Organization as Decoder<Organization>
            })

            SessionManager.currentSession!.setOrganization(response.data)
            toast.hide()
            new Toast("Mollie is gekoppeld", "success green").show()
            await Storage.keyValue.removeItem("mollie-saved-state")
        } catch (e) {
            console.error(e)
            toast.hide()
            new Toast("Koppelen mislukt", "error red").show()
        }
    }

    mounted() {
        const parts = UrlHelper.shared.getParts()
        const urlParams = UrlHelper.shared.getSearchParams()

        // We can clear now
        UrlHelper.shared.clear()

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie') {
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state) {
                this.doLinkMollie(code, state).catch(console.error);
            } else {
                const error = urlParams.get('error') ?? "";
                if (error) {
                    new Toast("Koppelen mislukt", "error red").show()
                }
            }
            this.updateMollie().catch(console.error);
        } else {
            if (this.organization.privateMeta && this.organization.privateMeta.mollieOnboarding) {
                this.updateMollie().catch(console.error);
            }
        }
        UrlHelper.setUrl("/settings/payments")
    }

    async updateMollie() {
        if (!this.organization.privateMeta?.mollieOnboarding) {
            return;
        }

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/mollie/check",
                decoder: Organization as Decoder<Organization>,
                shouldRetry: false
            })
           
            SessionManager.currentSession!.setOrganization(response.data)
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
    }

    async mollieDashboard() {
        if (this.loadingMollie) {
            return;
        }
        this.loadingMollie = true;

        const tab = (AppManager.shared.isNative ? null : window.open('about:blank'));

        if (!tab && !AppManager.shared.isNative) {
            this.loadingMollie = false;
            new Toast('Kon geen scherm openen', "error red").show()
            return
        }

        try {
            const url = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/mollie/dashboard",
                shouldRetry: false
            })
            console.log(url.data)

            if (AppManager.shared.isNative) {
                window.open(url.data as any)
            } else {
                tab!.location = url.data as any;
                tab!.focus();
            }
        } catch (e) {
            await this.updateMollie()
            tab?.close()
            this.errorBox = new ErrorBox(e)
        }
        
        this.loadingMollie = false;
    }

}
</script>