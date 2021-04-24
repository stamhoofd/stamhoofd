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
                    <STInputBox title="BTW-nummer" error-fields="VATNumber" :error-box="errorBox">
                        <input
                            v-model="VATNumber"
                            class="input"
                            type="url"
                            autocomplete="vat number"
                            placeholder="Optioneel"
                        >
                    </STInputBox>
                    <p class="style-description-small">
                        Vul zeker jouw BTW-nummer in als je die hebt (dan krijg je de BTW terug via je BTW-aangifte). Laat leeg als je een vrijstelling hebt. Vul geen foute nummers in.
                    </p>

                    <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                            </div>
                            <div>
                                <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                            </div>
                        </div>
                    </STInputBox>
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


            <hr>
            <h2>Wijzigingen aantal leden en domiciliering</h2>
            
            <p>
                Aangezien één van de pakketten op basis van het aantal leden is, en dat aantal kan wijzigen tijdens de looptijd van jouw pakket wordt dit als volgt afgehandeld:
            </p>

            <p class="style-description-block">
                Wanneer het aantal leden dat tergelijkertijd is ingeschreven op een bepaald moment hoger wordt dan het reeds betaald aantal ingeschreven leden, zullen er automatisch extra plaatsen aangekocht worden. Dat bedrag wordt opgeslagen als 'openstaand bedrag' en zal later via domiciliering afgerekend worden. Het bedrag dat per lid wordt aangerekend is afhankelijk van het aantal resterende dagen van het pakket. De eerste 3 maanden betaal je sowieso de volledige prijs per lid, daarna zal het bedrag per nieuw lid stelselmatig afnemen tot 0, op de vervaldag van het pakket. Als het aantal leden dat is ingeschreven daalt, zal je geen terugbetaling ontvangen, maar als het aantal leden daarna weer stijgt tot het oorspronkelijke aangekocht aantal plaatsen hoef je niet meer te betalen.
            </p>

            <p class="style-description-block">
                Het kan zijn dat we de facturatie en het inhouden van een bedrag uitstellen omdat het bedrag te laag is. Dit doen we om de administratieve overlast voor iedereen te beperken. Je kan het aantal facturen ook beperken door op voorhand al je leden in Stamhoofd te importeren (op die manier komen er later minder leden bij en blijft dat bedrag te laag om af te rekenen). Je kan op elk moment het openstaande bedrag raadplegen via de instellingen van Stamhoofd (bij facturen).
            </p>

            <Checkbox>Ik ga akkoord met de <a href="https://www.stamhoofd.be/" target="_blank" class="inline-link">algemene verkoopsvoorwaarden</a></Checkbox>

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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, Checkbox, ErrorBox, LoadingButton, PaymentSelectionList, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Address, Organization, OrganizationPatch, OrganizationPrivateMetaData, PaymentMethod, STInvoice, STInvoiceResponse, STPackage, User } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import { SelectablePackage } from "./PackageSettingsView.vue";

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
        Spinner
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

    proFormaInvoice: STInvoice | null = null

    selectedPaymentMethod: PaymentMethod = PaymentMethod.Unknown

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })
    userPatch = User.patch({ id: this.user.id })

    throttledReload = throttle(this.loadProForma, 1000)

    throttledLoadProForma() {
        this.loadingProForma = true

        // Use counter to ignore older requests
        this.loadingProFormaCount++;

        console.log(this.throttledReload)
        this.throttledReload();
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
                    proForma: true
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
        this.$set(this.organizationPatch, "address", address)
        this.throttledLoadProForma()
    }

    get VATNumber() {
        return this.organization.privateMeta?.VATNumber ?? ""
    }

    set VATNumber(VATNumber: string | null) {
        this.organizationPatch = this.organizationPatch.patch(Organization.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                VATNumber: VATNumber ? VATNumber : null
            })
        }))

        // Todo: not yet saved: so backend needs to know the pending patches first
        this.throttledLoadProForma()
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
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/billing/activate-packages",
                body: {
                    bundles: this.selectedPackages.map(p => p.bundle),
                    renewPackageIds: this.renewPackages.map(p => p.id),
                    paymentMethod: this.selectedPaymentMethod
                },
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>
            })
            if (response.data.paymentUrl) {
                window.location.href = response.data.paymentUrl;
            } else {
                // Go to invoice page
            }
        } catch (e) {
            this.errorBox = new ErrorBox(e)
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
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

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
