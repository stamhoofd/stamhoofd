<template>
    <div class="st-view background package-confirm-view">
        <STNavigationBar title="Pakketten activeren">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Nieuwe pakketten activeren
            </h1>

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

            <hr>
            <h2>Overzicht</h2>

            <Spinner v-if="loadingProForma" />

            <template v-else-if="proFormaInvoice">
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
                                {{ proFormaInvoice.meta.priceWithVAT | price }}
                            </template> 
                        </STListItem>
                    </STList>
                </div>
            </template>


            <template v-if="hasPerMember">
                <hr>
                <h2>Wijzigingen aantal leden en domiciliëring/automatische incasso</h2>
                
                <p>
                    Aangezien één van de pakketten op basis van het aantal leden is, en dat aantal kan wijzigen tijdens de looptijd van jouw pakket wordt dit als volgt afgehandeld:
                </p>

                <p class="style-description-block">
                    Wanneer het aantal leden dat tergelijkertijd is ingeschreven op een bepaald moment hoger wordt dan het reeds betaald aantal ingeschreven leden, zullen er automatisch extra plaatsen aangekocht worden. Dat bedrag wordt opgeslagen als 'openstaand bedrag' en zal later via domiciliëring/automatische incasso afgerekend worden. Het bedrag dat per lid wordt aangerekend is afhankelijk van het aantal resterende dagen van het pakket. De eerste 3 maanden betaal je sowieso de volledige prijs per lid, daarna zal het bedrag per nieuw lid stelselmatig afnemen tot 0, op de vervaldag van het pakket. Als het aantal leden dat is ingeschreven daalt, zal je geen terugbetaling ontvangen, maar als het aantal leden daarna weer stijgt tot het oorspronkelijke aangekocht aantal plaatsen hoef je niet meer te betalen.
                </p>

                <p class="style-description-block">
                    Het kan zijn dat we de facturatie en het inhouden van een bedrag uitstellen omdat het bedrag te laag is. Dit doen we om de administratieve overlast voor iedereen te beperken. Je kan het aantal facturen ook beperken door op voorhand al je leden in Stamhoofd te importeren (op die manier komen er later minder leden bij en blijft dat bedrag te laag om af te rekenen). Je kan op elk moment het openstaande bedrag raadplegen via de instellingen van Stamhoofd (bij facturen).
                </p>
            </template>
            <template v-else>
                <hr>
                <h2>Algemene voorwaarden</h2>
            </template>

            <Checkbox v-model="terms">
                Ik ga akkoord met de <a :href="'https://'+$t('shared.domains.marketing')+'/terms/algemene-voorwaarden'" target="_blank" class="inline-link">algemene voorwaarden</a>
            </Checkbox>

            <hr>

            <h2>Kies je betaalmethode</h2>

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />
        </main>

        <STToolbar :sticky="false">
            <template slot="right">
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="checkout">
                        Afrekenen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder,AutoEncoderPatchType, Decoder } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, CompanyNumberInput, ErrorBox, LoadingButton, PaymentSelectionList, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator, VATNumberInput } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Address, Country, Organization, OrganizationMetaData, OrganizationPatch, PaymentMethod, STInvoice, STInvoiceResponse, STPackage, STPricingType, User, Version } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import PackageSettingsView, { SelectablePackage } from "./PackageSettingsView.vue";

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
        AddressInput,
        Spinner,
        VATNumberInput,
        CompanyNumberInput
    },
    filters: {
        price: Formatter.price,
    }
})
export default class PackageConfirmView extends Mixins(NavigationMixin) {
    @Prop({ default: () => [] })
    selectedPackages: SelectablePackage[]

    @Prop({ default: () => [] })
    renewPackages: STPackage[]

    errorBox: ErrorBox | null = null
    validator = new Validator()

    loading = false
    loadingProForma = true
    loadingProFormaCount = 0

    terms = false

    proFormaInvoice: STInvoice | null = null

    selectedPaymentMethod: PaymentMethod = PaymentMethod.Unknown

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })
    userPatch = User.patch({ id: this.user.id })

    throttledReload = throttle(this.loadProForma, 1000)

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

    get hasPerMember() {
        return !!this.selectedPackages.find(p => p.package.meta.pricingType === STPricingType.PerMember) || !!this.renewPackages.find(p => p.meta.pricingType === STPricingType.PerMember)
    }

    mounted() {
        this.loadProForma().catch(console.error)
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
                    bundles: this.selectedPackages.map(p => p.bundle),
                    renewPackageIds: this.renewPackages.map(p => p.id),
                    paymentMethod: this.selectedPaymentMethod,
                    includePending: true,
                    proForma: true,
                    organizationPatch: this.organizationPatch.encode({ version: Version }),
                    userPatch: this.userPatch.encode({ version: Version }),
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

    get paymentMethods() {
        return [PaymentMethod.Bancontact, PaymentMethod.iDEAL]
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
                    human: "Je moet de algemene voorwaarden accepteren voor je een pakket kan activeren",
                    field: "terms"
                })
            }
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/billing/activate-packages",
                body: {
                    bundles: this.selectedPackages.map(p => p.bundle),
                    renewPackageIds: this.renewPackages.map(p => p.id),
                    includePending: true,
                    paymentMethod: this.selectedPaymentMethod,
                    organizationPatch: this.organizationPatch.encode({ version: Version }),
                    userPatch: this.userPatch.encode({ version: Version }),
                },
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>
            })
            if (response.data.paymentUrl) {
                window.location.href = response.data.paymentUrl;
            } else {
                // Reload organization
                SessionManager.currentSession?.fetchOrganization().catch(e => console.error)
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
        // todo
        if (this.loading) {
            return false
        }
        return true
    }
}
</script>

<style lang="scss">

.package-confirm-view {
    .pricing-box {
        max-width: 300px;
        margin-left: auto;

        .middle {
            font-weight: 600;
        }
    }
}
</style>
