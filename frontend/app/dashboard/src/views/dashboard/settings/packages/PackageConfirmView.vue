<template>
    <div class="st-view background package-confirm-view">
        <STNavigationBar title="Betalen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1 v-if="bundles.length === 1">
                {{ STPackageBundleHelper.getTitle(bundles[0]) }} activeren
            </h1>
            <h1 v-else-if="bundles.length" class="style-navigation-title">
                Functionaliteiten activeren
            </h1>
            <h1 v-else-if="isManualPayment" class="style-navigation-title">
                Openstaand bedrag betalen
            </h1>
            <h1 v-else-if="!allowMandate" class="style-navigation-title">
                Nieuwe betaalmethode toevoegen
            </h1>
            <h1 v-else-if="renewPackages.length" class="style-navigation-title">
                Functionaliteiten verlengen
            </h1>
            <h1 v-else class="style-navigation-title">
                Standaard betaalmethode wijzigen
            </h1>
            <p v-if="bundles.length">
                We hebben nog enkele gegevens van je nodig om de activatie te bevestigen.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <hr>
            <h2>Facturatiegegevens</h2>

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
                    <AddressInput v-if="hasCompanyNumber" key="companyAddress" v-model="companyAddress" :required="true" title="Maatschappelijke zetel" :validator="validator" />
                    <AddressInput v-else key="address" v-model="address" :required="true" title="Adres" :validator="validator" />
                </div>
                <div>
                    <STInputBox v-if="!hasCompanyNumber" title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                            </div>
                            <div>
                                <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                            </div>
                        </div>
                    </STInputBox>
                    <CompanyNumberInput v-if="hasCompanyNumber && (!hasVATNumber || country != 'BE')" v-model="companyNumber" :country="country" placeholder="Jullie ondernemingsnummer" :validator="validator" :required="true" />
                    <VATNumberInput v-if="hasVATNumber" v-model="VATNumber" title="BTW-nummer" placeholder="Jullie BTW-nummer" :country="country" :validator="validator" :required="true" />
                </div>
            </div>

            <template v-if="allowMandate || selectedMandateId">
                <hr>
                <h2 v-if="bundles.length || renewPackages.length">
                    Standaard betaalmethode
                </h2>
                <h2 v-else>
                    Betaalmethode
                </h2>

                <p v-if="bundles.length || renewPackages.length">
                    Je moet Stamhoofd koppelen aan een bankkaart waarmee je voor Stamhoofd zal betalen. Dit dient ter validatie van je vereniging. Deze bankkaart wordt enkel in specifieke gevallen aangesproken (als je geen online betalingen gebruikt, of een betaalmethode waarbij we via een andere weg de servicekosten moeten inhouden).
                </p>
                <p v-else>
                    Kies één van de reeds opgeslagen betaalmethodes of koppel een nieuwe betaalmethode.
                </p>

                <MandateSelectionList
                    v-model="selectedMandateId"
                    :organization="organization"
                    :required="false"
                /> 
            </template>

            <template v-if="proFormaInvoice && proFormaInvoice.meta.totalPrice > 0 && selectedMandateId === null">
                <hr>

                <h2>Kies je betaalmethode</h2>

                <p class="info-box">
                    Betaal met de bankrekening van jouw vereniging en niet met een persoonlijke rekening. Deze bankrekening zal gebruikt worden voor toekomstige afrekeningen via domiciliëring.
                </p>

                <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />
            </template>

            <template v-else-if="proFormaInvoice && proFormaInvoice.meta.totalPrice == 0 && selectedMandateId === null">
                <hr>

                <h2>Koppel de bankkaart of creditcard van je vereniging</h2>
                <p>
                    Je moet Stamhoofd koppelen aan een bankkaart waarmee je voor Stamhoofd zal betalen. Dit dient ter validatie van je vereniging. Deze bankkaart wordt enkel in specifieke gevallen aangesproken (als je geen online betalingen gebruikt, of een betaalmethode waarbij we via een andere weg de servicekosten moeten inhouden).
                </p>

                <p class="info-box">
                    Om je bankkaart te koppelen moeten we een betaling van 0,02 euro uitvoeren.
                </p>

                <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />
            </template>


            <Spinner v-if="loadingProForma" />

            <template v-else-if="proFormaInvoice && proFormaInvoice.meta.totalPrice > 0">
                <hr>
                <h2>Overzicht</h2>
                <STList>
                    <STListItem v-for="item in proFormaInvoice.meta.items" :key="item.id">
                        <template slot="left">
                            {{ item.amount }}x
                        </template>

                        <h3 class="style-title-list">
                            {{ item.name }}
                        </h3>
                        <p class="style-description">
                            {{ item.description }}
                        </p>

                        <template slot="right">
                            {{ item.price | price }}
                        </template>
                    </STListItem>
                </STList>

                <div class="pricing-box">
                    <STList>
                        <STListItem>
                            Prijs excl. BTW

                            <template slot="right">
                                {{ proFormaInvoice.meta.priceWithoutVAT | price }}
                            </template>
                        </STListItem>

                        <STListItem>
                            BTW ({{ proFormaInvoice.meta.VATPercentage }}%)
        
                            <template slot="right">
                                {{ proFormaInvoice.meta.VAT | price }}
                            </template>
                        </STListItem>

                        <STListItem>
                            Te betalen

                            <template slot="right">
                                {{ proFormaInvoice.meta.totalPrice | price }}
                            </template> 
                        </STListItem>
                    </STList>
                </div>
            </template>

            <hr>
            <h2>Algemene voorwaarden</h2>

            <STInputBox :error-box="errorBox" error-fields="terms" class="max">
                <Checkbox v-model="terms">
                    Ik ga akkoord met de <a :href="'https://'+$t('shared.domains.marketing')+'/terms/algemene-voorwaarden'" target="_blank" class="inline-link">algemene voorwaarden</a>
                </Checkbox>
            </STInputBox>

            <template v-if="renewPackageDetails">
                <hr>
                <h2>Prijsdetails</h2>
                <p>
                    Meer info over alle prijzen en een prijscalculator kan je terugvinden op <a :href="'https://'+$t('shared.domains.marketing')+'/prijzen'" class="inline-link" target="_blank">onze website</a>.
                </p>

                <STList v-if="renewPackageDetails.meta.pricingType === 'PerMember'">
                    <STListItem>
                        Huidig aantal leden

                        <template slot="right">
                            {{ renewPackageDetails.meta.paidAmount }}
                        </template>
                    </STListItem>

                    <STListItem v-if="renewPackageDetails.meta.unitPrice">
                        Prijs

                        <template slot="right">
                            {{ renewPackageDetails.meta.unitPrice | price }} / jaar / lid
                        </template>
                    </STListItem>

                    <STListItem v-if="renewPackageDetails.meta.minimumAmount">
                        Minimum bedrag per jaar

                        <template slot="right">
                            {{ renewPackageDetails.meta.minimumAmount * renewPackageDetails.meta.unitPrice | price }} 
                            ({{ renewPackageDetails.meta.minimumAmount }} leden)
                        </template>
                    </STListItem>

                    <STListItem>
                        Vanaf

                        <template slot="right">
                            {{ renewPackageDetails.meta.startDate | date }}
                        </template>
                    </STListItem>
                </STList>

                <STList v-else>
                    <STListItem v-if="renewPackageDetails.meta.startDate && renewPackageDetails.meta.startDate.getTime() > Date.now() + 10000">
                        Vanaf

                        <template slot="right">
                            {{ renewPackageDetails.meta.startDate | date }}
                        </template>
                    </STListItem>

                    <STListItem class="right-description">
                        Vaste prijs

                        <template slot="right">
                            {{ renewPackageDetails.meta.unitPrice | price }}
                        </template>
                    </STListItem>

                    <STListItem v-if="renewPackageDetails.meta.serviceFeePercentage && renewPackageDetails.meta.serviceFeeFixed" class="right-description">
                        Servicekosten

                        <template slot="right">
                            {{ renewPackageDetails.meta.serviceFeePercentage | percentage }} +
                            {{ renewPackageDetails.meta.serviceFeeFixed | price }}
                        </template>
                    </STListItem>

                    <STListItem v-else-if="renewPackageDetails.meta.serviceFeePercentage" class="right-description">
                        Servicekosten per stuk/ticket

                        <template slot="right">
                            {{ renewPackageDetails.meta.serviceFeePercentage | percentage }}
                            <p v-if="renewPackageDetails.meta.serviceFeeMinimum" class="style-description-small">
                                min. {{ renewPackageDetails.meta.serviceFeeMinimum | price }}
                            </p>
                            <p v-if="renewPackageDetails.meta.serviceFeeMaximum" class="style-description-small">
                                max. {{ renewPackageDetails.meta.serviceFeeMaximum | price }}
                            </p>
                        </template>
                    </STListItem>

                    <STListItem v-else-if="renewPackageDetails.meta.serviceFeeFixed">
                        Servicekosten per stuk/ticket

                        <template slot="right">
                            {{ renewPackageDetails.meta.serviceFeeFixed | price }}
                        </template>
                    </STListItem>
                </STList>
            </template>

            <p v-if="memberCountWarning" class="warning-box">
                {{ memberCountWarning }}
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="loading">
                    <button v-if="bundles.length || renewPackages.length" class="button primary" type="button" @click="checkout">
                        <span class="icon success" />
                        <span>Activeren</span>
                    </button>
                    <button v-else-if="isManualPayment" class="button primary" type="button" @click="checkout">
                        <span>Betalen</span>
                        <span class="icon arrow-right" />
                    </button>
                    <button v-else-if="!selectedMandateId" class="button primary" type="button" @click="checkout">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                    <button v-else class="button primary" type="button" @click="checkout">
                        <span>Opslaan</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, CompanyNumberInput, ErrorBox, LoadingButton, PaymentSelectionList, Radio, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator, VATNumberInput } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Address, Country, Organization, OrganizationMetaData, OrganizationPatch, PaymentMethod, STInvoice, STInvoiceResponse, STPackage, STPackageBundle, STPackageBundleHelper, STPackageType, User, Version } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import MandateSelectionList from "./MandateSelectionList.vue";
import PackageSettingsView from "./PackageSettingsView.vue";

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();
            
        lastFunc = setTimeout(function() {
            if (Date.now() - lastRan >= limit) {
                func.apply(context, args);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        LoadingButton,
        STList,
        STListItem,
        Checkbox,
        PaymentSelectionList,
        MandateSelectionList,
        AddressInput,
        Spinner,
        VATNumberInput,
        CompanyNumberInput,
        Radio
    },
    filters: {
        price: Formatter.price,
        percentage: Formatter.percentage,
    }
})
export default class PackageConfirmView extends Mixins(NavigationMixin) {
    @Prop({ default: () => [] })
        bundles: STPackageBundle[]

    @Prop({ default: () => [] })
        renewPackages: STPackage[]

    @Prop({ default: true })
        allowMandate: boolean;

    /**
     * Manual payment of outstanding balance
     */
    @Prop({ default: false })
        isManualPayment: boolean

    errorBox: ErrorBox | null = null
    validator = new Validator()

    loading = false
    loadingProForma = true
    loadingProFormaCount = 0

    terms = false

    proFormaInvoice: STInvoice | null = null

    selectedPaymentMethod: PaymentMethod = PaymentMethod.Unknown
    selectedMandateId: string | null = null;

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })
    userPatch = User.patch({ id: this.user.id })

    throttledReload = throttle(this.loadProForma, 1000)
    STPackageBundleHelper = STPackageBundleHelper;

    throttledLoadProForma() {
        if (this.loading) {
            // Skip
            return
        }
        this.loadingProForma = true

        // Use counter to ignore older requests
        this.loadingProFormaCount++;

        this.throttledReload();
    }

    mounted() {
        this.loadProForma().catch(console.error)
    }

    @Watch('selectedMandateId')
    onSelectedMandateIdChange() {
        this.throttledLoadProForma()
    }

    get renewPackageDetails() {
        if (this.proFormaInvoice?.meta?.items?.length !== 1) {
            return null
        }
        const p = this.proFormaInvoice.meta.items[0].package
        return p ?? null;
    }

    async loadProForma() {
        this.loadingProForma = true

        // Use counter to ignore older requests
        this.loadingProFormaCount++;
        const c = this.loadingProFormaCount

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/billing/activate-packages",
                body: {
                    bundles: this.bundles,
                    renewPackageIds: this.renewPackages.map(p => p.id),
                    includePending: this.selectedMandateId ? (this.bundles.length || this.renewPackages.length ? false : true) : true,
                    paymentMethod: this.selectedMandateId ? PaymentMethod.Unknown : this.selectedPaymentMethod,
                    organizationPatch: this.organizationPatch.encode({ version: Version }),
                    userPatch: this.userPatch.encode({ version: Version }),
                    mandateId: this.selectedMandateId,
                    proForma: true,
                },
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>
            })
            if (c === this.loadingProFormaCount) {
                this.proFormaInvoice = response.data.invoice ?? null
            }
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        if (c === this.loadingProFormaCount) {
            this.loadingProForma = false
        }
    }

    get user() {
        return User.create(SessionManager.currentSession!.user!)
    }

    get patchedUser() {
        return this.user.patch(this.userPatch)
    }

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get firstName() {
        return this.patchedUser.firstName
    }

    set firstName(firstName: string | null) {
        this.$set(this.userPatch, "firstName", firstName)
    }

    get lastName() {
        return this.patchedUser.lastName
    }

    set lastName(lastName: string | null) {
        this.$set(this.userPatch, "lastName", lastName)
    }


    get name() {
        return this.organization.name
    }

    set name(name: string) {
        this.$set(this.organizationPatch, "name", name)
    }

    get address() {
        return this.organization.address
    }

    set address(address: Address) {
        if (this.address.toString() !== address.toString()) {
            this.$set(this.organizationPatch, "address", address)
            this.throttledLoadProForma()
        }
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
        this.throttledLoadProForma()
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
        this.throttledLoadProForma()
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
        this.throttledLoadProForma()
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

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    get paymentMethods() {
        const extra: PaymentMethod[] = []

        if (this.getFeatureFlag('stamhoofd-pay-by-transfer')) {
            extra.push(PaymentMethod.Transfer)
        }

        if (this.country == Country.Netherlands) {
            return [PaymentMethod.iDEAL, PaymentMethod.Bancontact, PaymentMethod.CreditCard, ...extra]
        }
        return [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.CreditCard, ...extra]
    }

    get memberCountWarning(): string | null {
        if (this.renewPackages.some(p => p.meta.type === STPackageType.Members)) {
            return 'Vergeet niet eerst een nieuwe inschrijvingsperiode te starten voor alle inschrijvingsgroepen, zodat ingeschreven leden van vorig jaar niet meteen opnieuw worden aangerekend (op zich geen verschil als je ledenaantal niet zakt). Inschrijvingsgroepen (zoals activiteiten) die je niet (meteen) verderzet, kan je archiveren.';
        }

        return null;
    }
    
    async checkout() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            if (!await this.validator.validate()) {
                this.loading = false
                return
            }

            if (!this.terms) {
                throw new SimpleError({
                    code: "terms_required",
                    message: "The terms should be accepted",
                    human: "Je moet de algemene voorwaarden accepteren voor je een betaling kan doen",
                    field: "terms"
                })
            }
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/billing/activate-packages",
                body: {
                    bundles: this.bundles,
                    renewPackageIds: this.renewPackages.map(p => p.id),
                    includePending: this.selectedMandateId ? (this.bundles.length || this.renewPackages.length ? false : true) : true,
                    paymentMethod: this.selectedMandateId ? PaymentMethod.Unknown : this.selectedPaymentMethod,
                    organizationPatch: this.organizationPatch.encode({ version: Version }),
                    userPatch: this.userPatch.encode({ version: Version }),
                    mandateId: this.selectedMandateId,
                },
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>
            })
            if (response.data.paymentUrl) {
                window.location.href = response.data.paymentUrl;
            } else {
                // Reload organization
                try {
                    await SessionManager.currentSession?.fetchOrganization();
                } catch (e) {
                    console.error(e)
                }
                new CenteredMessage("Gelukt", "Het pakket wordt meteen geactiveerd").addCloseButton().show()
                this.show({
                    components: [new ComponentWithProperties(PackageSettingsView)], 
                    replace: this.navigationController?.components.length, 
                    reverse: true,
                    force: true
                })
            }
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            this.loading = false

            // Reload if something changed
            this.throttledLoadProForma()
        }

        this.loading = false
    }
  
    shouldNavigateAway() {
        // TODO
        if (this.loading) {
            return false
        }
        return true
    }
}
</script>