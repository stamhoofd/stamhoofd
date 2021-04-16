<template>
    <div class="st-view background">
        <STNavigationBar title="Pakketten activeren">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Facturatiegegevens
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

            <h2>Kies je betaalmathode</h2>

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />


            <hr>
            <h2>Te betalen</h2>

            <STList>
                <STListItem>
                    Prijs excl. BTW

                    <template slot="right">
                        {{ priceWithoutVAT | price }}
                    </template>
                </STListItem>

                <STListItem>
                    BTW ({{ VATPercentage }}%)
 
                    <template slot="right">
                        {{ VAT | price }}
                    </template>
                </STListItem>

                <STListItem>
                    Te betalen

                    <template slot="right">
                        {{ totalPrice | price }}
                    </template> 
                </STListItem>
            </STList>
        </main>

        <STToolbar>
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
import { AddressInput,BackButton,Checkbox, ErrorBox, LoadingButton, PaymentSelectionList, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Address, calculateVATPercentage, Organization, OrganizationPatch, OrganizationPrivateMetaData, PaymentMethod, STInvoiceResponse, User } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import { SelectablePackage } from "./PackageSettingsView.vue";

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
        AddressInput
    },
    filters: {
        price: Formatter.price,
    }
})
export default class PackageConfirmView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    selectedPackages: SelectablePackage[]

    errorBox: ErrorBox | null = null
    validator = new Validator()

    loading = false

    selectedPaymentMethod: PaymentMethod = PaymentMethod.Unknown

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })
    userPatch = User.patch({ id: this.user.id })

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
    }

    get paymentMethods() {
        return [PaymentMethod.Bancontact, PaymentMethod.iDEAL]
    }

    // Other
    get VATPercentage() {
        return calculateVATPercentage(this.organization.address, this.VATNumber)
    }

    get priceWithoutVAT() {
        return this.selectedPackages.reduce((total, item) => total + item.package.meta.totalPrice, 0)
    }

    get VAT() {
        return Math.round(this.priceWithoutVAT * this.VATPercentage / 100)
    }

    get totalPrice() {
        return this.priceWithoutVAT + this.VAT
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


</style>
