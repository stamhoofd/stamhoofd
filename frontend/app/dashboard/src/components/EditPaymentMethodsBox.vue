<template>
    <div>
        <Spinner v-if="loadingStripeAccounts" />
        <div v-else>
            <STInputBox v-if="(stripeAccountObject === null && stripeAccounts.length > 0) || stripeAccounts.length > 1 || (stripeAccounts.length > 0 && hasMollieOrBuckaroo)" title="Betaalaccount" error-fields="stripeAccountId">
                <Dropdown v-model="stripeAccountId">
                    <option v-if="hasMollieOrBuckaroo" :value="null">
                        {{ mollieOrBuckarooName }}
                    </option>
                    <option v-else :value="null">
                        Geen
                    </option>
                    <option v-for="account in stripeAccounts" :key="account.id" :value="account.id">
                        {{ account.meta.business_profile.name }} - {{ account.accountId }}, xxxx {{ account.meta.bank_account_last4 }} ({{ account.meta.bank_account_bank_name }})
                    </option>
                </Dropdown>
            </STInputBox>
            <p v-if="stripeAccountObject && stripeAccountObject.warning" class="warning-box">
                {{ stripeAccountObject.warning }}
            </p>

            <STList>
                <STListItem v-for="method in sortedPaymentMethods" :key="method" :selectable="true" element-name="label">
                    <Checkbox slot="left" :checked="getPaymentMethod(method)" @change="setPaymentMethod(method, $event)" />
                    <h3 class="style-title-list">
                        {{ getName(method) }}
                    </h3>
                    <p v-if="showPrices" class="style-description pre-wrap" v-text="getDescription(method)" />
                </STListItem>
            </STList>
        </div>
    </div>
</template>


<script lang="ts">
import { ArrayDecoder, Decoder, PatchableArray } from "@simonbackx/simple-encoding";
import { Checkbox, Dropdown, Spinner, STInputBox, STList, STListItem, Toast } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { SessionManager } from "@stamhoofd/networking";
import { Country, Organization, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentProviderConfiguration, StripeAccount } from "@stamhoofd/structures";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    components: {
        Checkbox,
        STList,
        STListItem,
        Spinner,
        STInputBox,
        Dropdown
    },
})
export default class EditPaymentMethodsBox extends Vue {
    @Prop({ required: true })
        organization: Organization

    @Prop({ required: true })
        methods: PaymentMethod[]

    @Prop({ required: true })
        providerConfig: PaymentProviderConfiguration

    @Prop({ required: false, default: null })
        choices: PaymentMethod[] | null

    @Prop({ required: false, default: true })
        showPrices: boolean

    loadingStripeAccounts = false
    stripeAccounts: StripeAccount[] = []

    created() {
        this.loadStripeAccounts().catch(console.error)
    }

    async loadStripeAccounts() {
        try {
            this.loadingStripeAccounts = true
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/stripe/accounts",
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                shouldRetry: false
            })
            this.stripeAccounts = response.data

            if (!this.hasMollieOrBuckaroo && !this.stripeAccountObject) {
                this.stripeAccountId = this.stripeAccounts[0]?.id ?? null
            }
        } catch (e) {
            console.error(e)
        }
        this.loadingStripeAccounts = false
    }
    
    get country() {
        return I18nController.shared.country
    }

    get stripeAccountId() {
        return this.providerConfig.stripeAccountId
    }

    set stripeAccountId(value: string | null) {
        this.$emit("patch:providerConfig", PaymentProviderConfiguration.patch({
            stripeAccountId: value
        }));
    }

    get stripeAccountObject() {
        return this.stripeAccounts.find(a => a.id == this.stripeAccountId) ?? null
    }

    get sortedPaymentMethods() {
        if (this.choices !== null) {
            return this.choices
        }

        const r: PaymentMethod[] = [
            PaymentMethod.Transfer
        ]

        // Force a given ordering
        if (this.country == Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        if (this.country == Country.Belgium || this.getPaymentMethod(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq)
        }

        // Force a given ordering
        r.push(PaymentMethod.Bancontact)

        // Force a given ordering
        if (this.country != Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        r.push(PaymentMethod.CreditCard)
        r.push(PaymentMethod.PointOfSale)
        return r
    }

    getName(paymentMethod: PaymentMethod): string {
        return PaymentMethodHelper.getNameCapitalized(paymentMethod)
    }
    
    providerText(provider: PaymentProvider | null, map: {[key: string]: string}): string {
        if (provider == null || !Object.prototype.hasOwnProperty.call(map, provider)) {
            return Object.values(map).join("\n")
        } else {
            return map[provider]
        }
    }

    getDescription(paymentMethod: PaymentMethod): string {
        const provider = this.organization.privateMeta?.getPaymentProviderFor(paymentMethod, this.stripeAccountObject?.meta) ?? PaymentProvider.Buckaroo

        switch (paymentMethod) {
            case PaymentMethod.Transfer: return "Gratis, maar je moet elke betaling zelf controleren en markeren als betaald in Stamhoofd"
            case PaymentMethod.Payconiq: 
                return this.providerText(provider, {
                    [PaymentProvider.Payconiq]: "€ 0,20 / transactie via Payconiq zelf",
                    [PaymentProvider.Buckaroo]: "€ 0,25 / transactie  via Buckaroo"
                })
            case PaymentMethod.Bancontact: 
                return this.providerText(provider, {
                    [PaymentProvider.Buckaroo]: "€ 0,25 / transactie via Buckaroo",
                    [PaymentProvider.Mollie]: "€ 0,31 / transactie via Mollie",
                    [PaymentProvider.Stripe]: "€ 0,24 + 0,2% / transactie via Stripe",
                })
            
            case PaymentMethod.iDEAL:  
                return this.providerText(provider, {
                    [PaymentProvider.Buckaroo]: "€ 0,25 / transactie via Buckaroo",
                    [PaymentProvider.Mollie]: "€ 0,29 / transactie via Mollie",
                    [PaymentProvider.Stripe]: "€ 0,24 + 0,2% / transactie via Stripe",
                })
            case PaymentMethod.CreditCard: 
                return this.providerText(provider, {
                    [PaymentProvider.Buckaroo]: "€ 0,25 + 1,8% voor gewone kaarten (Europese Unie)\n€ 0,25 + 2,8% voor business of buiten-EU kaarten",
                    [PaymentProvider.Mollie]: "€ 0,25 + 1,8% voor gewone kaarten (Europese Unie)\n€ 0,25 + 2,8% voor business of buiten-EU kaarten",
                    [PaymentProvider.Stripe]: "€ 0,15 + 1% voor gewone kaarten (Europese Unie)\n€ 0,15 + 2,8% voor business of buiten-EU kaarten"
                });
            case PaymentMethod.Unknown: return ""
            case PaymentMethod.DirectDebit: return ""
            case PaymentMethod.PointOfSale: return "Gratis, maar minder handig."
        }
    }

    getPaymentMethod(method: PaymentMethod) {
        return this.methods.includes(method)
    }

    setPaymentMethod(method: PaymentMethod, enabled: boolean) {
        if (enabled === this.getPaymentMethod(method)) {
            return
        }
        
        const arr = new PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>()
        if (enabled) {
            const errorMessage = this.getEnableErrorMessage(method)
            if (this.choices === null && errorMessage) {
                new Toast(errorMessage, "error red").setHide(15*1000).show()
                return
            }
            arr.addPut(method)
        } else {
            if (this.choices === null && this.methods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }

            arr.addDelete(method)
        }

        this.$emit('patch', arr)
    }

    get hasMollieOrBuckaroo() {
        return this.organization.privateMeta?.buckarooSettings !== null || !!this.organization.privateMeta?.mollieOnboarding?.canReceivePayments
    }

    get mollieOrBuckarooName() {
        if (this.organization.privateMeta?.buckarooSettings !== null) {
            return "Buckaroo"
        }
        return "Mollie"
    }

    getEnableErrorMessage(paymentMethod: PaymentMethod): string | undefined {
        if (this.stripeAccountObject) {
            if (this.organization.privateMeta?.getPaymentProviderFor(paymentMethod, this.stripeAccountObject.meta) === PaymentProvider.Stripe)  {
                return;
            }
        }

        if (this.organization.privateMeta?.buckarooSettings?.paymentMethods.includes(paymentMethod)) {
            return
        }

        switch (paymentMethod) {
            case PaymentMethod.Payconiq: {
                if ((this.organization.privateMeta?.payconiqApiKey ?? "").length == 0) {
                    return "Je moet eerst Payconiq activeren via de betaalinstellingen (Instellingen > Betaalmethodes), dat kan via Buckaroo of rechtstreeks via Payconiq. Daar vind je ook meer informatie."
                }
                break
            }

            case PaymentMethod.iDEAL:
            case PaymentMethod.CreditCard:
            case PaymentMethod.Bancontact: {
                if (!this.organization.privateMeta?.mollieOnboarding || !this.organization.privateMeta.mollieOnboarding.canReceivePayments) {
                    return "Je kan "+PaymentMethodHelper.getName(paymentMethod)+" niet activeren, daarvoor moet je eerst aansluiten bij een betaalprovider via de Stamhoofd instellingen > Betaalaccounts."
                }
                break
            }
        }
    }


}
</script>