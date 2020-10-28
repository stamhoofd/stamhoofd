<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Instellingen
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <hr>
            <h2>Algemeen</h2>

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

                    <IBANInput v-model="iban" title="Bankrekeningnummer" :validator="validator" :required="false" />
                </div>
            </div>

            <hr>
            <h2>Huisstijl</h2>
            <p>Als je een logo hebt kan je deze hier toevoegen. Je kan kiezen om een vierkant logo, een horizontaal logo of beide te uploaden. We kiezen dan automatisch het beste logo afhankelijk van de schermgrootte.</p>

            <div class="split-inputs">
                <div>
                    <ImageInput v-model="horizontalLogo" title="Horizontaal logo" :validator="validator" :resolutions="horizontalLogoResolutions" :required="false" />

                    <p class="st-list-description">
                        Beter voor grotere schermen.
                    </p>
                </div>

                <div>
                    <ImageInput v-model="squareLogo" title="Vierkant logo" :validator="validator" :resolutions="squareLogoResolutions" :required="false" />
                    <p class="st-list-description">
                        Beter voor op kleine schermen. Laat tekst zoveel mogelijk weg uit dit logo.
                    </p>
                </div>
            </div>

            <ColorInput v-model="color" title="Hoofdkleur (optioneel)" :validator="validator" placeholder="Geen kleur" :required="false" />
            <p class="st-list-description">
                Vul hierboven de HEX-kleurcode van jouw hoofdkleur in. Laat leeg om het blauwe kleur te behouden.
            </p>

            <hr>
            <h2>Domeinnaam</h2>

            <template v-if="organization.privateMeta && organization.privateMeta.pendingMailDomain">
                <p class="warning-box">
                    Jouw nieuwe domeinnaam ({{ organization.privateMeta.pendingMailDomain }}) is nog niet geactiveerd. Voeg de DNS-records toe en verifieer je wijzigingen om deze te activeren.
                </p>
                <p class="st-list-description">
                    <button class="button secundary" @click="openRecords">
                        DNS-records instellen en verifiëren
                    </button>
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Wijzigen</span>
                    </button>
                </p>
            </template>

            <template v-else-if="organization.privateMeta && organization.privateMeta.mailDomain">
                <p class="st-list-description">
                    Jouw inschrijvingspagina is bereikbaar via <a class="button inline-link" :href="'https://'+(organization.registerDomain || organization.uri+'.stamhoofd.be')" target="_blank">{{ organization.registerDomain || organization.uri+'.stamhoofd.be' }}</a> en jouw e-mails kunnen worden verstuurd vanaf <strong>iets@{{ organization.privateMeta.mailDomain }}</strong>.
                </p>
                
                <p v-if="!organization.privateMeta.mailDomainActive" class="warning-box">
                    Jouw e-mail domeinnaam is nog niet actief, deze wordt binnenkort geactiveerd.
                </p>

                <p class="st-list-description">
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Domeinnaam wijzigen</span>
                    </button>
                </p>
            </template>

            <template v-else>
                <p class="st-list-description">
                    Jouw inschrijvingspagina is bereikbaar via <a class="button inline-link" :href="'https://'+organization.uri+'.stamhoofd.be'" target="_blank">{{ organization.uri }}.stamhoofd.be</a>. Je kan ook je eigen domeinnaam (bv. inschrijven.mijnvereniging.be) instellen. Hiervoor moet je wel het domeinnaam al gekocht hebben, meestal zal dat al het geval zijn als je al een eigen website hebt.
                </p>

                <p class="st-list-description">
                    <button class="button text" @click="setupDomain">
                        <span class="icon settings" />
                        <span>Domeinnaam instellen</span>
                    </button>
                </p>
            </template>

            <hr>
            <h2>E-mailadressen</h2>
            
            <p v-if="organization.privateMeta && organization.privateMeta.mailDomainActive" class="st-list-description">
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt die eindigen op @{{ organization.privateMeta.mailDomain }}, kan je e-mails versturen vanaf dat e-mailadres. Bij andere e-mailadressen (bv. {{ organization.uri }}@gmail.com) kunnen we enkel instellen dat leden antwoorden naar dat e-mailadres, de e-mail wordt nog steeds verstuurd vanaf iets@{{ organization.privateMeta.mailDomain }}. Voeg enkel e-mailadressen toe waar je ook e-mails kan op ontvangen.
            </p>
            <p v-else class="st-list-description">
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt met jouw eigen domeinnaam (bv. info@mijnvereniging.be), kan je e-mails versturen vanaf dat e-mailadres als je het domeinnaam hierboven eerst toevoegt. Bij andere e-mailadressen (bv. {{ organization.uri }}@gmail.com) kunnen we enkel instellen dat leden antwoorden naar dat e-mailadres, de e-mail wordt nog steeds verstuurd vanaf iets@{{ organization.uri }}.stamhoofd.be. Voeg enkel e-mailadressen toe waarop je e-mails kan ontvangen.
            </p>

            <p class="st-list-description">
                <button class="button text" @click="setupEmail">
                    <span class="icon settings" />
                    <span>E-mailadressen instellen</span>
                </button>
            </p>

            <hr>
            <h2>Jouw privacyvoorwaarden</h2>
            <p class="st-list-description">
                Om in orde te zijn met de GDPR-wetgeving moet je jouw privacyvoorwaarden instellen. Bij het maken van een account moeten jouw leden deze goedkeuren.
            </p>

            <STInputBox title="Waar staan jouw privacyvoorwaarden?" error-fields="privacy" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-model="selectedPrivacyType" value="none">
                        Geen
                    </Radio>
                    <Radio v-model="selectedPrivacyType" value="website">
                        Op jouw website
                    </Radio>
                    <Radio v-model="selectedPrivacyType" value="file">
                        Zelf PDF-bestand aanleveren
                    </Radio>
                </RadioGroup>
            </STInputBox>

            <STInputBox v-if="selectedPrivacyType == 'website'" title="Volledige link naar privacyvoorwaarden" error-fields="privacyPolicyUrl" :error-box="errorBox">
                <input
                    v-model="privacyPolicyUrl"
                    class="input"
                    type="url"
                    placeholder="bv. https://www.vereniging.be/privacy"
                >
            </STInputBox>

            <FileInput v-if="selectedPrivacyType == 'file'" v-model="privacyPolicyFile" title="Kies een bestand" :validator="validator" :required="false" />

            <hr>
            <h2>Betaalmethodes</h2>

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
            <h2>Online betalingen activeren</h2>

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
                    Online betalingen via Bancontact of iDEAL zijn geactiveerd (je kan ze hierboven aanzetten).
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
import { AddressInput, BackButton, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
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
export default class SettingsView extends Mixins(NavigationMixin) {
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

    get squareLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 44,
                width: 44,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 44*3,
                width: 44*3,
                fit: ResolutionFit.Inside
            })
        ]
    }

    get horizontalLogoResolutions() {
        return [
            ResolutionRequest.create({
                height: 44,
                width: 300,
                fit: ResolutionFit.Inside
            }),
            ResolutionRequest.create({
                height: 44*3,
                width: 300*3,
                fit: ResolutionFit.Inside
            })
        ]
    }

    get color() {
        return this.organization.meta.color
    }

    set color(color: string | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.$set(this.organizationPatch.meta!, "color", color)
    }

    get squareLogo() {
        return this.organization.meta.squareLogo
    }

    set squareLogo(image: Image | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.$set(this.organizationPatch.meta!, "squareLogo", image)
    }

    get horizontalLogo() {
        return this.organization.meta.horizontalLogo
    }

    set horizontalLogo(image: Image | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.$set(this.organizationPatch.meta!, "horizontalLogo", image)
    }

    get website() {
        return this.organization.website ?? ""
    }

    set website(website: string) {
        this.$set(this.organizationPatch, "website", website.length == 0 ? null : website)
    }

   get privacyPolicyUrl() {
        return this.organization.meta.privacyPolicyUrl
    }

    set privacyPolicyUrl(url: string | null) {
        if (!this.organizationPatch.meta) {
            this.$set(this.organizationPatch, "meta", OrganizationMetaData.patch({}))
        }

        this.organizationPatch.meta!.set({
            privacyPolicyUrl: url
        })
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


    get address() {
        return this.organization.address
    }

    set address(address: Address) {
        this.organizationPatch.address = address
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
            new Toast('De wijzigingen zijn opgeslagen', "success green").setWithOffset().show()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    setupDomain() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(DomainSettingsView, {})
        }).setDisplayStyle("popup"))
    }

    setupEmail() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailSettingsView, {})
        }).setDisplayStyle("popup"))
    }

    openRecords() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(DNSRecordsView, {})
        }).setDisplayStyle("popup"))
    }

    shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        if (confirm("Ben je zeker dat je de instellingen wilt sluiten zonder op te slaan?")) {
            return true;
        }
        return false;
    }

    linkMollie() {
        // Start oauth flow
        const client_id = process.env.NODE_ENV == "development" ? "app_8mK3BCPCqd8sSkQmuNC8xmgu" : "app_awGyMjwGgRue2zjJBrdkEWuK"
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
        HistoryManager.setUrl("/settings")
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


#settings-view {
    .dns-settings {
        padding: 20px 0;
        max-width: 500px;;

        dd {
            font-family: monospace;
            white-space: nowrap;
        }
    }

    .logo-placeholder {
        @extend .style-input;
        @extend .style-input-shadow;
        border: $border-width solid $color-gray-light;
        color: $color-gray;
        background: white;
        border-radius: $border-radius;
        padding: 5px 15px;
        height: 60px;
        margin: 0;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 0.2s, color 0.2s;
        outline: none;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        cursor: pointer;
        touch-action: manipulation;


        &:hover {
            border-color: $color-primary-gray-light;
            color: $color-primary;
        }

        &:active {
            border-color: $color-primary;
            color: $color-primary;
        }

        &.square {
            width: 60px;
        }

        &.horizontal {
            width: 300px;
        }
    }
}
</style>
