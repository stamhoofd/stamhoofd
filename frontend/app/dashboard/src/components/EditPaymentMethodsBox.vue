<template>
    <LoadingView v-if="loadingStripeAccounts" />
    <div v-else class="container">
        <STErrorsDefault :error-box="errorBox" />
        <STInputBox v-if="(stripeAccountObject === null && stripeAccounts.length > 0) || stripeAccounts.length > 1 || (stripeAccounts.length > 0 && hasMollieOrBuckaroo)" title="Betaalaccount" error-fields="stripeAccountId">
            <Dropdown v-model="stripeAccountId">
                <option v-if="hasMollieOrBuckaroo" :value="null">
                    {{ mollieOrBuckarooName }}
                </option>
                <option v-else :value="null">
                    Geen
                </option>
                <option v-for="account in stripeAccounts" :key="account.id" :value="account.id">
                    {{ account.meta.settings.dashboard.display_name }} - {{ account.meta.business_profile.name }}, xxxx {{ account.meta.bank_account_last4 }} - {{ account.accountId }}
                </option>
            </Dropdown>
        </STInputBox>
        <p v-if="stripeAccountObject && stripeAccountObject.warning" :class="stripeAccountObject.warning.type + '-box'">
            {{ stripeAccountObject.warning.text }}
            <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/documenten-stripe-afgekeurd/'" target="_blank" class="button text">
                Meer info
            </a>
        </p>


        <STList>
            <STListItem v-for="method in sortedPaymentMethods" :key="method" :selectable="true" element-name="label" :disabled="!canEnablePaymentMethod(method)">
                <template #left><Checkbox :model-value="getPaymentMethod(method)" @update:model-value="setPaymentMethod(method, $event)" /></template>
                <h3 class="style-title-list">
                    {{ getName(method) }}
                </h3>
                <p v-if="showPrices && getPaymentMethod(method) && getDescription(method)" class="style-description-small pre-wrap" v-text="getDescription(method)" />
            </STListItem>
        </STList>

        <template v-if="hasTransfers">
            <hr>

            <h2>Overschrijvingen</h2>

            <STInputBox title="Begunstigde" error-fields="transferSettings.creditor" :error-box="errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    :placeholder="organization.name"
                    autocomplete=""
                >
            </STInputBox>

            <IBANInput v-model="iban" title="Bankrekeningnummer" :validator="validator" :required="true" />

            <STInputBox title="Soort mededeling" error-fields="transferSettings.type" :error-box="errorBox" class="max">
                <STList>
                    <STListItem v-for="_type in transferTypes" :key="_type.value" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="transferType" :value="_type.value" />
                        </template>
                        <h3 class="style-title-list">
                            {{ _type.name }}
                        </h3>
                        <p v-if="transferType == _type.value" class="style-description pre-wrap" v-text="_type.description" />
                    </STListItem>
                </STList>
            </STInputBox>

            <p v-if="transferType !== 'Structured'" class="warning-box">
                <span>De mededeling kan niet gewijzigd worden door <span v-if="type === 'webshop'">bestellers</span><span v-else>leden</span>. Voorzie dus zelf geen eigen vervangingen zoals <em class="style-em">bestelling + naam</em> waarbij je ervan uitgaat dat de betaler manueel de mededeling kan invullen en wijzigen. Gebruik in plaats daarvan de 'Vaste mededeling' met de beschikbare automatische vervangingen.</span>
            </p>

            <STInputBox v-if="transferType != 'Structured'" :title="transferType == 'Fixed' ? 'Mededeling' : 'Voorvoegsel'" error-fields="transferSettings.prefix" :error-box="errorBox">
                <input
                    v-model="prefix"
                    class="input"
                    type="text"
                    :placeholder="transferType == 'Fixed' ? 'Mededeling' : (type === 'registration' ? 'Optioneel. Bv. Inschrijving' : 'Optioneel. Bv. Bestelling')"
                    autocomplete=""
                >
            </STInputBox>

            <p v-if="transferExample && transferExample !== prefix" class="style-description-small">
                Voorbeeld: <span class="style-em">{{ transferExample }}</span>
            </p>

            <p v-if="transferType === 'Fixed' && type === 'webshop'" class="style-description-small">
                Gebruik automatische tekstvervangingen in de mededeling via <code v-copyable class="style-inline-code style-copyable" v-text="`{{naam}}`" />, <code v-copyable class="style-inline-code style-copyable" v-text="`{{email}}`" /> of <code v-copyable class="style-inline-code style-copyable" v-text="`{{nr}}`" />
            </p>
            <p v-else-if="transferType === 'Fixed' && type === 'registration'" class="style-description-small">
                Gebruik automatische tekstvervangingen in de mededeling via <code v-copyable class="style-inline-code style-copyable" v-text="`{{naam}}`" />
            </p>
        </template>

        <template v-if="showAdministrationFee">
            <hr>
            <h2>Administratiekosten</h2>
            <p>Breng een kost in rekening per betaling (dus slechts één keer, ook als er meerdere zaken worden afgerekend in één betaling). Hiermee kan je de kost van Stamhoofd recupereren en/of de tijd die je bezig bent met het verwerken van inschrijvingen/bestellingen. Wettelijk gezien is het niet toegestaan dat je deze laat afhangen van de gekozen betaalmethode (dat is dus niet mogelijk).</p>
        
            <div class="split-inputs">
                <STInputBox title="Vaste kost" error-fields="administrationFee.fixed" :error-box="errorBox">
                    <PriceInput v-model="fixed" :min="0" placeholder="Vaste kost" :required="true" />
                </STInputBox>

                <STInputBox title="Percentage" error-fields="administrationFee.fixed" :error-box="errorBox">
                    <PermyriadInput v-model="percentage" placeholder="Percentage" :required="true" />
                </STInputBox>
            </div>

            <Checkbox v-if="fixed > 0" v-model="zeroIfZero">
                Reken geen administratiekosten aan als het totaalbedrag 0 euro is
            </Checkbox>

            <p v-if="percentage && exampleAdministrationFee1" class="style-description-small">
                Voorbeeld: de aangerekende administratiekost bedraagt {{ formatPrice(exampleAdministrationFee1) }} op een bedrag van {{ formatPrice(exampleAdministrationFeeValue1) }}, en {{ formatPrice(exampleAdministrationFee2) }} op een bedrag van {{ formatPrice(exampleAdministrationFeeValue2) }}.
            </p>
        </template>
    </div>
</template>


<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { Checkbox, Dropdown, ErrorBox, IBANInput,LoadingView,PermyriadInput,PriceInput,Radio, Spinner, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { SessionManager } from "@stamhoofd/networking";
import { AdministrationFeeSettings, Country, Organization, PaymentConfiguration, PaymentMethod, PaymentMethodHelper, PaymentProvider, PrivatePaymentConfiguration, StripeAccount, TransferDescriptionType, TransferSettings } from "@stamhoofd/structures";
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        Checkbox,
        STList,
        STListItem,
        LoadingView,
        STInputBox,
        Dropdown,
        Radio,
        IBANInput,
        PriceInput,
        PermyriadInput,
        STErrorsDefault
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class EditPaymentMethodsBox extends Vue {
    @Prop({ required: true })
        type: 'registration'|'webshop'

    @Prop({ default: true })
        showAdministrationFee: boolean

    @Prop({ default: null }) 
        validator: Validator | null

    errorBox: ErrorBox | null = null

    @Prop({ required: true })
        organization: Organization

    @Prop({ required: true })
        privateConfig: PrivatePaymentConfiguration

    @Prop({ required: true })
        config: PaymentConfiguration

    @Prop({ required: false, default: null })
        choices: PaymentMethod[] | null

    @Prop({ required: false, default: true })
        showPrices: boolean

    loadingStripeAccounts = false
    stripeAccounts: StripeAccount[] = []

    created() {
        this.loadStripeAccounts().catch(console.error)
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.clean()
        await this.$nextTick()
        
        if (this.loadingStripeAccounts) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'loading',
                message: "Nog bezig met laden. Even geduld."
            }))
            return false
        }

        if (this.config.paymentMethods.length === 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'no_payment_methods',
                message: "Je moet minimaal één betaalmethode selecteren"
            }))
            return false
        }

        return true;
    }

    patchPrivateConfig(patch: AutoEncoderPatchType<PrivatePaymentConfiguration>) {
        this.$emit("patch:privateConfig", patch)
    }

    patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
        this.$emit("patch:config", patch)
    }

    get hasTransfers() {
        return this.config.paymentMethods.includes(PaymentMethod.Transfer)
    }

    async loadStripeAccounts() {
        try {
            this.loadingStripeAccounts = true
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/stripe/accounts",
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                shouldRetry: true,
                owner: this
            })
            this.stripeAccounts = response.data

            if (!this.hasMollieOrBuckaroo && !this.stripeAccountObject) {
                this.stripeAccountId = this.stripeAccounts[0]?.id ?? null
            }

            this.$nextTick(() => {
                this.setDefaultSelection()
            })
        } catch (e) {
            console.error(e)
        }
        this.loadingStripeAccounts = false
    }

    setDefaultSelection() {
        if (this.config.paymentMethods.length == 0) {
            const ignore = [
                PaymentMethod.Unknown,
                PaymentMethod.Transfer,
                PaymentMethod.PointOfSale
            ]

            let found = false;

            // Check if online payments are enabled
            for (const p of this.sortedPaymentMethods) {
                if (!ignore.includes(p) && this.canEnablePaymentMethod(p)) {
                    this.setPaymentMethod(p, true)
                    found = true
                }
            }

            if (!found) {
                // Enable transfer
                this.setPaymentMethod(PaymentMethod.Transfer, true)
            }
        } else {
            this.clean()
        }
    }
    
    get country() {
        return I18nController.shared.country
    }

    get stripeAccountId() {
        return this.privateConfig.stripeAccountId
    }

    set stripeAccountId(value: string | null) {
        this.patchPrivateConfig(PrivatePaymentConfiguration.patch({
            stripeAccountId: value
        }));

        // Clear all unsupported payment methods
        this.$nextTick(() => {
            this.clean()
        })
    }

    clean() {
        for (const method of this.config.paymentMethods) {
            if (!this.canEnablePaymentMethod(method)) {
                this.setPaymentMethod(method, false, true)
            }
        }
    }

    get stripeAccountObject() {
        return this.stripeAccounts.find(a => a.id == this.stripeAccountId) ?? null
    }

    get sortedPaymentMethods() {
        if (this.choices !== null) {
            return this.choices
        }

        const r: PaymentMethod[] = []

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
        
        r.push(PaymentMethod.Transfer)
        r.push(PaymentMethod.PointOfSale)

        // Sort so all disabled are at the end:
        r.sort((a, b) => Sorter.byBooleanValue(this.canEnablePaymentMethod(a), this.canEnablePaymentMethod(b)))
        return r
    }

    getName(paymentMethod: PaymentMethod): string {
        return PaymentMethodHelper.getNameCapitalized(paymentMethod)
    }
    
    providerText(provider: PaymentProvider | null, map: {[key: string]: string}): string {
        if (provider == null) {
            return ""
        } else {
            return map[provider]
        }
    }

    getDescription(paymentMethod: PaymentMethod): string {
        const provider = this.organization.privateMeta?.getPaymentProviderFor(paymentMethod, this.stripeAccountObject?.meta) ?? PaymentProvider.Stripe

        switch (paymentMethod) {
            case PaymentMethod.Transfer: return "Je moet elke betaling zelf controleren en markeren als betaald in Stamhoofd"
            case PaymentMethod.Payconiq: 
                return this.providerText(provider, {
                    [PaymentProvider.Payconiq]: "",
                    [PaymentProvider.Buckaroo]: "Via Buckaroo"
                })
            case PaymentMethod.Bancontact: 
                return this.providerText(provider, {
                    [PaymentProvider.Buckaroo]: "Via Buckaroo",
                    [PaymentProvider.Mollie]: "Via Mollie",
                    [PaymentProvider.Stripe]: "",
                })
            
            case PaymentMethod.iDEAL:  
                return this.providerText(provider, {
                    [PaymentProvider.Buckaroo]: "Via Buckaroo",
                    [PaymentProvider.Mollie]: "Via Mollie",
                    [PaymentProvider.Stripe]: "",
                })
            case PaymentMethod.CreditCard: 
                return this.providerText(provider, {
                    [PaymentProvider.Buckaroo]: "Via Buckaroo",
                    [PaymentProvider.Mollie]: "Via Mollie",
                    [PaymentProvider.Stripe]: "",
                })
            case PaymentMethod.Unknown: return ""
            case PaymentMethod.DirectDebit: return ""
            case PaymentMethod.PointOfSale: return "De betaling loopt niet via Stamhoofd"
        }
    }

    getPaymentMethod(method: PaymentMethod) {
        return this.config.paymentMethods.includes(method)
    }

    setPaymentMethod(method: PaymentMethod, enabled: boolean, force = false) {
        if (enabled === this.getPaymentMethod(method)) {
            return
        }
        
        const arr = new PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>()
        if (enabled) {
            const errorMessage = this.getEnableErrorMessage(method)
            if (!force && this.choices === null && errorMessage) {
                new Toast(errorMessage, "error red").setHide(15*1000).show()
                return
            }
            arr.addPut(method)
        } else {
            if (!force && this.choices === null && this.config.paymentMethods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }

            arr.addDelete(method)
        }

        this.patchConfig(PaymentConfiguration.patch({
            paymentMethods: arr
        }))
    }

    canEnablePaymentMethod(method: PaymentMethod) {
        const errorMessage = this.getEnableErrorMessage(method)
        return this.choices !== null || !errorMessage
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
        if (paymentMethod === PaymentMethod.Unknown || paymentMethod === PaymentMethod.Transfer || paymentMethod === PaymentMethod.PointOfSale) {
            return
        }

        if (this.organization.privateMeta?.getPaymentProviderFor(paymentMethod, this.stripeAccountObject?.meta))  {
            return;
        }

        if (this.organization.privateMeta?.buckarooSettings?.paymentMethods.includes(paymentMethod)) {
            return
        }

        switch (paymentMethod) {
            case PaymentMethod.Payconiq: {
                if ((this.organization.privateMeta?.payconiqApiKey ?? "").length == 0) {
                    return "Je moet eerst Payconiq activeren via de betaalinstellingen (Instellingen > Betaalmethodes). Daar vind je ook meer informatie."
                }
                break
            }

            case PaymentMethod.iDEAL:
            case PaymentMethod.CreditCard:
            case PaymentMethod.Bancontact: {
                if (this.stripeAccountObject) {
                    return PaymentMethodHelper.getName(paymentMethod)+" is nog niet geactiveerd door Stripe. Kijk na of alle nodige informatie is ingevuld in jullie Stripe dashboard. Vaak is het probleem dat het adres van één van de bestuurders ontbreekt in Stripe of de websitelink van de vereniging niet werd ingevuld."
                }
                break
            }
        }

        return "Je kan "+PaymentMethodHelper.getName(paymentMethod)+" niet activeren, daarvoor moet je eerst aansluiten bij een betaalprovider via de Stamhoofd instellingen > Betaalaccounts."
    }

    // Administration cost
    get fixed() {
        return this.config.administrationFee.fixed
    }

    set fixed(fixed: number) {
        this.patchConfig(PaymentConfiguration.patch({
            administrationFee: AdministrationFeeSettings.patch({
                fixed: Math.max(0, fixed)
            })
        }))
    }

    get percentage() {
        return this.config.administrationFee.percentage
    }

    set percentage(percentage: number) {
        this.patchConfig(PaymentConfiguration.patch({
            administrationFee: AdministrationFeeSettings.patch({
                percentage: Math.min(10000, Math.max(0, percentage))
            })
        }))
    }

    get zeroIfZero() {
        return this.config.administrationFee.zeroIfZero
    }

    set zeroIfZero(zeroIfZero: boolean) {
        this.patchConfig(PaymentConfiguration.patch({
            administrationFee: AdministrationFeeSettings.patch({
                zeroIfZero
            })
        }))
    }

    get exampleAdministrationFeeValue1() {
        return 500;
    }

    get exampleAdministrationFee1() {
        return this.config.administrationFee.calculate(this.exampleAdministrationFeeValue1)
    }

    get exampleAdministrationFeeValue2() {
        if (this.zeroIfZero) {
            return 0;
        }
        return 1000;
    }

    get exampleAdministrationFee2() {
        return this.config.administrationFee.calculate(this.exampleAdministrationFeeValue2)
    }

    // Transfer settings
    get transferTypes() {
        return [
            { 
                value: TransferDescriptionType.Structured,
                name: this.$t('shared.transferTypes.structured'),
                description: "Willekeurig aangemaakt."
            },
            { 
                value: TransferDescriptionType.Reference,
                name: this.type === 'registration' ? "Naam van lid/leden" : "Bestelnummer",
                description: "Eventueel voorafgegaan door een zelf gekozen woord (zie onder)"
            },
            { 
                value: TransferDescriptionType.Fixed,
                name: "Vaste mededeling",
                description: this.type === 'registration' ? 
                    "Altijd dezelfde mededeling voor alle inschrijvingen. Een betaling kan voor meerdere inschrijvingen tegelijk zijn."
                    :
                    "Altijd dezelfde mededeling voor alle bestellingen."

            }
        ]
    }

    get transferTypeDescription() {
        return this.transferTypes.find(t => t.value === this.transferType)?.description ?? ""
    }

    get creditor() {
        return this.config.transferSettings.creditor
    }

    set creditor(creditor: string | null ) {
        this.patchConfig(PaymentConfiguration.patch({ 
            transferSettings: TransferSettings.patch({
                creditor: !creditor || creditor.length == 0 || creditor == this.organization.name ? null : creditor
            })
        }))
    }

    get iban() {
        return this.config.transferSettings.iban
    }

    set iban(iban: string | null ) {
        this.patchConfig(PaymentConfiguration.patch({ 
            transferSettings: TransferSettings.patch({
                iban: !iban || iban.length == 0 ? null : iban
            })
        }))
    }

    get prefix() {
        return this.config.transferSettings.prefix
    }

    set prefix(prefix: string | null ) {
        this.patchConfig(PaymentConfiguration.patch({ 
            transferSettings: TransferSettings.patch({
                prefix
            })
        }))
    }

    get transferType() {
        return this.config.transferSettings.type
    }

    set transferType(type: TransferDescriptionType ) {
        this.patchConfig(PaymentConfiguration.patch({ 
            transferSettings: TransferSettings.patch({
                type
            })
        }))
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get transferExample() {
        const fakeReference = this.type === 'registration' ? this.$t('shared.exampleData.names').toString() : "152";
        const settings = this.config.transferSettings

        return settings.generateDescription(fakeReference, this.organization.address.country, {
            nr: this.type === 'registration' ? '' : fakeReference,
            email: this.type === 'registration' ? '' : this.$t('shared.exampleData.email').toString(),
            phone: this.type === 'registration' ? '' : this.$t('shared.exampleData.phone').toString(),
            name: this.type === 'registration' ? this.$t('shared.exampleData.names').toString() : this.$t('shared.exampleData.name').toString(),
            naam: this.type === 'registration' ? this.$t('shared.exampleData.names').toString() : this.$t('shared.exampleData.name').toString(),
        })
    }

}
</script>