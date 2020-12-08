<template>
    <div class="st-view background">
        <STNavigationBar title="Betaalmethodes">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else class="button icon close gray" @click="pop" slot="right" />
        </STNavigationBar>

        <main>
            <h1>
                Betaalmethodes
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="enableMemberModule">
                <h2>Betaalmethodes voor inschrijvingen</h2>

                <Checkbox v-model="enableTransfers">
                    Overschrijvingen (gratis, maar zelf op te volgen)
                </Checkbox>
                <Checkbox v-model="enablePayconiq">
                    Payconiq (20 cent)
                </Checkbox>
                <Checkbox v-model="enableBancontact">
                    Bancontact (31 cent)
                </Checkbox>
                <Checkbox v-model="enableIDEAL">
                    iDEAL (29 cent)
                </Checkbox>

                <hr>
            </template>

            <h2>Overschrijvingen</h2>

            <IBANInput v-model="iban" title="Bankrekeningnummer" :validator="validator" :required="false" />

            <hr>
            <h2>Payconiq activeren</h2>
            <p class="st-list-description">
                Wil je Payconiq activeren? Stuur ons dan een mailtje via hallo@stamhoofd.be. We bezorgen je dan de nodige contracten die we daarna aan Payconiq bezorgen. Je moet dit ook doen als je reeds Payconiq gebruikt voor betalingen via een vaste QR-sticker. Daarna ontvang je van Stamhoofd of Payconiq een API key die je hieronder moet ingeven.
            </p>

            <STInputBox title="API Key" error-fields="payconiqApiKey" :error-box="errorBox" class="max">
                <input
                    v-model="payconiqApiKey"
                    class="input"
                    type="text"
                    placeholder="API Key van Payconiq"
                >
            </STInputBox>

            <hr>
            <h2>Bancontact &amp; iDEAL</h2>

            <template v-if="!organization.privateMeta.mollieOnboarding">
                <p class="st-list-description">
                    Momenteel werk je met (gratis) overschrijvingen, maar als je dat wilt kan je ook online betalingen accepteren aan een tarief van 31 cent voor een Bancontact betaling. Hiervoor werken we samen met onze betaalpartner, Mollie. Je kan een account in Mollie aanmaken en koppelen met de knop hieronder.
                </p>

                <p class="st-list-description">
                    <button class="button text" @click="linkMollie">
                        <span class="icon link" />
                        <span>Mollie koppelen</span>
                    </button>
                </p>
            </template>
            <template v-else>
                <p v-if="organization.privateMeta.mollieOnboarding.canReceivePayments" class="success-box">
                    Online betalingen via Bancontact of iDEAL zijn beschikbaar (je moet ze aanzetten waar je ze wil gebruiken).
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
                        <button class="button text" @click="mollieDashboard">
                            <span class="icon edit" />
                            <span>Gegevens in Mollie aanvullen of aanpassen</span>
                        </button>
                    </LoadingButton>
                </p>
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
import { AutoEncoder, AutoEncoderPatchType, Decoder, PatchableArray,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, File, Image, Organization, OrganizationMetaData, OrganizationPatch, OrganizationPrivateMetaData,PaymentMethod, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';

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

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get iban() {
        return this.organization.meta.iban
    }

    set iban(iban: string) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patchType().create({}))
        }
        this.$set(this.organizationPatch.meta!, "iban", iban ?? "")
    }

     get payconiqApiKey() {
        return this.organization.privateMeta?.payconiqApiKey ?? ""
    }

    set payconiqApiKey(payconiqApiKey: string) {
        if (!this.organizationPatch.privateMeta) {
            this.$set(this.organizationPatch, "privateMeta", OrganizationPrivateMetaData.patchType().create({}))
        }
        this.$set(this.organizationPatch.privateMeta!, "payconiqApiKey", payconiqApiKey.length == 0 ? null : payconiqApiKey)
    }
   
    get enableTransfers() {
        return this.organization.meta.paymentMethods.includes(PaymentMethod.Transfer)
    }

    set enableTransfers(enable: boolean) {
        if (enable == this.enableTransfers) {
            return;
        }
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }
        if (enable) {
            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addPut(PaymentMethod.Transfer)
        } else {
            if (this.organization.meta.paymentMethods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }
            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addDelete(PaymentMethod.Transfer) 
        }
    }

    get enablePayconiq() {
        return this.organization.meta.paymentMethods.includes(PaymentMethod.Payconiq)
    }

    set enablePayconiq(enable: boolean) {
        if (enable == this.enablePayconiq) {
            return;
        }

        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        if (enable) {
            if (this.payconiqApiKey.length == 0) {
                new Toast("Om Payconiq te activeren moet je eerst aansluiten bij Payconiq via jouw bank. Daarna kunnen we bij Payconiq een code aanvragen die we nodig hebben om betalingen te verwerken. Stuur ons zeker een mailtje via hallo@stamhoofd.be bij vragen in afwachting van onze documentatie.", "error red").setHide(15000).show();
                return;
            }
            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addPut(PaymentMethod.Payconiq)
        } else {
            if (this.organization.meta.paymentMethods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }

            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addDelete(PaymentMethod.Payconiq) 
        }
    }
    
    get enableBancontact() {
        return this.organization.meta.paymentMethods.includes(PaymentMethod.Bancontact)
    }

    set enableBancontact(enable: boolean) {
        if (enable == this.enableBancontact) {
            return;
        }

        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        if (enable) {
            if (!this.organization.privateMeta?.mollieOnboarding || !this.organization.privateMeta.mollieOnboarding.canReceivePayments) {
                new Toast("Je kan Bancontact niet activeren, daarvoor moet je eerst online betalingen hieronder activeren. Daarna kan je Bancontact betalingen accepteren.", "error red").show();
                return
            }
            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addPut(PaymentMethod.Bancontact)
        } else {
            if (this.organization.meta.paymentMethods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }

            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addDelete(PaymentMethod.Bancontact) 
        }
    }

    get enableIDEAL() {
        return this.organization.meta.paymentMethods.includes(PaymentMethod.iDEAL)
    }

    set enableIDEAL(enable: boolean) {
        if (enable == this.enableIDEAL) {
            return;
        }

        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        if (enable) {
            if (!this.organization.privateMeta?.mollieOnboarding || !this.organization.privateMeta.mollieOnboarding.canReceivePayments) {
                new Toast("Je kan iDEAL niet activeren, daarvoor moet je eerst online betalingen hieronder activeren. Daarna kan je iDEAL betalingen accepteren.", "error red").show();
                return
            }
            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addPut(PaymentMethod.iDEAL)
        } else {
            if (this.organization.meta.paymentMethods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }

            (this.organizationPatch.meta!.paymentMethods as PatchableArray<string, string, string>).addDelete(PaymentMethod.iDEAL) 
        }
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
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
        this.dismiss({ force: true })
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    linkMollie() {
        // Start oauth flow
        const client_id = process.env.NODE_ENV != "production" ? "app_8mK3BCPCqd8sSkQmuNC8xmgu" : "app_awGyMjwGgRue2zjJBrdkEWuK"
        const state = new Buffer(crypto.getRandomValues(new Uint32Array(16))).toString('base64');

        const scope = "payments.read payments.write refunds.read refunds.write organizations.read organizations.write onboarding.read onboarding.write profiles.read profiles.write subscriptions.read subscriptions.write mandates.read mandates.write subscriptions.read subscriptions.write"
        const url = "https://www.mollie.com/oauth2/authorize?client_id="+encodeURIComponent(client_id)+"&state="+encodeURIComponent(state)+"&scope="+encodeURIComponent(scope)+"&response_type=code&approval_prompt=auto&locale=nl_BE"

        window.location.href = url;
    }

    async doLinkMollie(code: string) {
        const toast = new Toast("Koppelen...", "spinner").setHide(null).show()

        try {
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
        } catch (e) {
            toast.hide()
            new Toast("Koppelen mislukt", "error red").show()
        }
    }

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        console.log(path);

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie') {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state) {
                this.doLinkMollie(code);
            } else {
                const error = urlParams.get('error') ?? "";
                if (error) {
                    new Toast("Koppelen mislukt", "error red").show()
                }
            }
            this.updateMollie();
        } else {
            if (this.organization.privateMeta && this.organization.privateMeta.mollieOnboarding) {
                this.updateMollie();
            }
        }
        HistoryManager.setUrl("/settings/payments")
    }

     async updateMollie() {
        if (!this.organization.privateMeta?.mollieOnboarding) {
             return;
        }

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/mollie/check",
                decoder: Organization as Decoder<Organization>
            })
           
            SessionManager.currentSession!.setOrganization(response.data)
        } catch (e) {
        }
    }

    async mollieDashboard() {
        if (this.loadingMollie) {
            return;
        }
        this.loadingMollie = true;

        const tab = window.open('about:blank')!;

        try {
            const url = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/mollie/dashboard"
            })
            console.log(url.data)

            tab.location = url.data as any;
            tab.focus();
        } catch (e) {
            tab.close()
            this.errorBox = new ErrorBox(e)
        }
        
        this.loadingMollie = false;
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
