<template>
    <SaveView :loading="saving" title="Exporteren" :disabled="!canContinue" save-text="Exporteren" @save="save">
        <h1>
            Cijfers exporteren
        </h1>

        <div class="split-inputs">
            <STInputBox title="Vanaf" error-fields="startDate" :error-box="errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox title="Tot en met" error-fields="endDate" :error-box="errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>

        <p class="style-description-small">
            Snel selecteren: <span v-for="(suggestion, index) in dateRangeSuggestions" :key="suggestion.name">
                <button type="button" class="inline-link" :class="isSuggestionSelected(suggestion) ? {secundary: false} : {secundary: true}" @click="selectSuggestion(suggestion)">
                    {{ suggestion.name }}
                </button><template v-if="index < dateRangeSuggestions.length - 1">, </template>
            </span>
        </p>

        <hr>
        <h2>Betaalmethodes</h2>

        <STList>
            <STListItem v-for="method in sortedPaymentMethods" :key="method" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :modelValue="getPaymentMethod(method)" @update:modelValue="setPaymentMethod(method, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ getMethodName(method) }}
                </h3>
            </STListItem>
        </STList>


        <template v-if="allPaymentProviders.length">
            <hr>
            <h2>Betaalaccounts</h2>

            <STList>
                <STListItem v-for="provider in allPaymentProviders" :key="provider" :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Checkbox :modelValue="getProvider(provider)" @update:modelValue="setProvider(provider, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getProviderName(provider) }}
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="getProvider('Stripe') || useUTCTimezone">
            <hr>
            <h2>Tijdzone</h2>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useUTCTimezone" />
                    </template>
                    <h3 class="style-title-list">
                        Gebruik UTC-tijdzone
                    </h3>
                    <p class="style-description-small">
                        Voor de maandelijkse facturen van Stripe gebruiken we de UTC-tijdzone.
                    </p>
                </STListItem>
            </STList>
        </template>

        <hr>
        <h2>Webshops</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Checkbox v-model="allWebshopsSelected" />
                </template>
                <h3 class="style-title-list">
                    Alle webshops
                </h3>
            </STListItem>

            <template v-if="!allWebshopsSelected">
                <STListItem v-for="webshop in allWebshops" :key="webshop.id" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :modelValue="getWebshop(webshop.id)" @update:modelValue="setWebshop(webshop.id, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ webshop.meta.name }}
                    </h3>
                </STListItem>
            </template>
        </STList>

        <hr>
        <h2>Inschrijvingsgroepen</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Checkbox v-model="allGroupsSelected" />
                </template>
                <h3 class="style-title-list">
                    Alle inschrijvingsgroepen
                </h3>
            </STListItem>

            <template v-if="!allGroupsSelected">
                <STListItem v-for="group in allGroups" :key="group.id" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :modelValue="getGroup(group.id)" @update:modelValue="setGroup(group.id, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ group.settings.name }}
                    </h3>
                </STListItem>
            </template>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, DateSelection, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput,Validator } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { SessionManager } from "@stamhoofd/networking";
import { BalanceItemPaymentDetailed, Country, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentProvider, StripeAccount } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import PaymentExportView from "./PaymentExportView.vue";

class DateRangeSuggestion {
    name: string;
    startDate: Date;
    endDate: Date;

    constructor({ name, startDate, endDate }: { name: string, startDate: Date, endDate: Date }) {
        this.name = name
        this.startDate = startDate
        this.endDate = endDate
    }
}
@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        STList,
        STListItem,
        SaveView,
        DateSelection,
        TimeInput
    }
})
export default class ConfigurePaymentExportView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false


    internalStartDate = new Date()
    internalEndDate = new Date()
    
    methods: PaymentMethod[] = []
    providers: PaymentProvider[] = []

    webshops: string[]|null = null;
    groups: string[]|null = null;

    loadingStripeAccounts = false
    stripeAccounts: StripeAccount[] = []

    dateRangeSuggestions: DateRangeSuggestion[] = []

    useUTCTimezone = false

    created() {
        this.loadStripeAccounts().catch(console.error)
    }

    mounted() {
        this.methods = this.sortedPaymentMethods.slice()
        this.buildSuggestions()
        this.selectSuggestion(this.dateRangeSuggestions[0])
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date) + ':'+ date?.getSeconds() + ':'+ date?.getMilliseconds()
    }

    get startDate() {
        return this.internalStartDate
    }

    set startDate(value: Date) {
        this.internalStartDate = new Date(value.getTime())
        this.internalStartDate.setHours(0, 0, 0, 0)
        
    }

    get endDate() {
        return this.internalEndDate
    }

    set endDate(value: Date) {
        this.internalEndDate = new Date(value.getTime())
        this.internalEndDate.setHours(23, 59, 59, 0)
    }

    get correctedStartDate() {
        if (this.useUTCTimezone) {
            const date = new Date()
            date.setUTCFullYear(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate())
            date.setUTCHours(0, 0, 0, 0)
            return date
        } else {
            return this.startDate
        }
    }

    get correctedEndDate() {
        if (this.useUTCTimezone) {
            const date = new Date()
            date.setUTCFullYear(this.endDate.getFullYear(), this.endDate.getMonth(), this.endDate.getDate())
            date.setUTCHours(23, 59, 59, 0)
            return date
        } else {
            return this.endDate
        }
    }

    buildSuggestions() {
        this.dateRangeSuggestions = [
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().startOf("month").toJSDate()),
                startDate: Formatter.luxon().startOf("month").toJSDate(),
                endDate: Formatter.luxon().endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().minus({ month: 1 }).startOf("month").toJSDate()),
                startDate: Formatter.luxon().minus({ month: 1 }).startOf("month").toJSDate(),
                endDate: Formatter.luxon().minus({ month: 1 }).endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().minus({ month: 2 }).startOf("month").toJSDate()),
                startDate: Formatter.luxon().minus({ month: 2 }).startOf("month").toJSDate(),
                endDate: Formatter.luxon().minus({ month: 2 }).endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.month(Formatter.luxon().minus({ month: 3 }).startOf("month").toJSDate()),
                startDate: Formatter.luxon().minus({ month: 3 }).startOf("month").toJSDate(),
                endDate: Formatter.luxon().minus({ month: 3 }).endOf("month").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.year(Formatter.luxon().startOf("year").toJSDate()).toString(),
                startDate: Formatter.luxon().startOf("year").toJSDate(),
                endDate: Formatter.luxon().endOf("year").toJSDate(),
            }),
            new DateRangeSuggestion({
                name: Formatter.year(Formatter.luxon().minus({ year: 1 }).startOf("year").toJSDate()).toString(),
                startDate: Formatter.luxon().minus({ year: 1 }).startOf("year").toJSDate(),
                endDate: Formatter.luxon().minus({ year: 1 }).endOf("year").toJSDate(),
            }),
        ]
    }

    selectSuggestion(suggestion: DateRangeSuggestion) {
        this.startDate = suggestion.startDate
        this.endDate = suggestion.endDate
    }

    isSuggestionSelected(suggestion: DateRangeSuggestion) {
        return Formatter.dateIso(this.startDate) == Formatter.dateIso(suggestion.startDate) && Formatter.dateIso(this.endDate) == Formatter.dateIso(suggestion.endDate)
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    get organization() {
        return this.$organization
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    get allWebshopsSelected() {
        return this.webshops === null
    }

    set allWebshopsSelected(value: boolean) {
        if (value) {
            this.webshops = null
        } else {
            this.webshops = []
        }
    }

    get allGroupsSelected() {
        return this.groups === null
    }

    set allGroupsSelected(value: boolean) {
        if (value) {
            this.groups = null
        } else {
            this.groups = []
        }
    }

    get country() {
        return I18nController.shared.country
    }

    get hasPayconiq() {
        return !!this.organization.privateMeta?.payconiqApiKey
    }

    get hasMollie() {
        return !!this.organization.privateMeta?.mollieOnboarding?.canReceivePayments
    }

    get hasBuckaroo() {
        return this.organization.privateMeta?.buckarooSettings !== null
    }

    async loadStripeAccounts() {
        try {
            this.loadingStripeAccounts = true
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/stripe/accounts",
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                shouldRetry: false,
                owner: this
            })
            this.stripeAccounts = response.data
            this.providers = this.allPaymentProviders.slice()
        } catch (e) {
            console.error(e)
        }
        this.loadingStripeAccounts = false
    }

    get sortedPaymentMethods() {
        const r: PaymentMethod[] = [
            PaymentMethod.Transfer
        ]

        // Force a given ordering
        if (this.country == Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        r.push(PaymentMethod.Bancontact)

        // Force a given ordering
        if (this.country == Country.Belgium || this.getPaymentMethod(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq)
        }

        // Force a given ordering
        if (this.country != Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        r.push(PaymentMethod.CreditCard)
        r.push(PaymentMethod.PointOfSale)
        return r
    }

    get allPaymentProviders() {
        const r: PaymentProvider[] = []

        if (this.stripeAccounts.length > 0) {
            r.push(PaymentProvider.Stripe)
        }

        if (this.hasPayconiq) {
            r.push(PaymentProvider.Payconiq)
        }

        if (this.hasMollie) {
            r.push(PaymentProvider.Mollie)
        }

        if (this.hasBuckaroo) {
            r.push(PaymentProvider.Buckaroo)
        }
             
        return r
    }

    getProviderName(provider: PaymentProvider) {
        return provider
    }

    getMethodName(paymentMethod: PaymentMethod): string {
        return PaymentMethodHelper.getNameCapitalized(paymentMethod)
    }

    getPaymentMethod(method: PaymentMethod) {
        return this.methods.includes(method)
    }

    setPaymentMethod(method: PaymentMethod, enabled: boolean) {
        this.methods = this.methods.filter(m => m != method)
        if (enabled) {
            this.methods.push(method)
        }
    }

    getProvider(provider: PaymentProvider) {
        return this.providers.includes(provider)
    }

    setProvider(provider: PaymentProvider, enabled: boolean) {
        this.providers = this.providers.filter(m => m != provider)
        if (enabled) {
            this.providers.push(provider)
        }
    }

    get allWebshops() {
        return this.organization.webshops
    }

    get allGroups() {
        return this.organization.groups
    }

    getWebshop(id: string) {
        return this.webshops?.includes(id) ?? true
    }

    setWebshop(id: string, enabled: boolean) {
        if (this.webshops === null) {
            this.webshops = []
        }
        this.webshops = this.webshops.filter(m => m != id)
        if (enabled) {
            this.webshops.push(id)
        }
    }

    getGroup(id: string) {
        return this.groups?.includes(id) ?? true
    }

    setGroup(id: string, enabled: boolean) {
        if (this.groups === null) {
            this.groups = []
        }
        this.groups = this.groups.filter(m => m != id)
        if (enabled) {
            this.groups.push(id)
        }
    }

    get canContinue() {
        return this.methods.length > 0 && (this.providers.length > 0 || this.methods.includes(PaymentMethod.Transfer) || this.methods.includes(PaymentMethod.PointOfSale)) && (this.webshops === null || this.webshops.length || this.groups === null || this.groups.length)
    }
   
    async save() {
        if (this.saving) {
            return;
        }

        this.saving = true;

        try {
            const payments: PaymentGeneral[] = []
            await this.downloadUntil(payments)
            
            this.show({
                components: [
                    new ComponentWithProperties(PaymentExportView, {
                        stripeAccounts: this.stripeAccounts,
                        payments,
                        filterBalanceItems: this.webshops !== null || this.groups !== null ? (balanceItem: BalanceItemPaymentDetailed) => {
                            if (this.webshops !== null) {
                                if (balanceItem.balanceItem.order) {
                                    if (!this.webshops.includes(balanceItem.balanceItem.order.webshopId)) {
                                        return false
                                    }
                                }
                            }
                            if (this.groups !== null) {
                                if (balanceItem.balanceItem.registration) {
                                    if (!this.groups.includes(balanceItem.balanceItem.registration.groupId)) {
                                        return false
                                    }
                                }
                            }

                            return !!balanceItem.balanceItem.order || !!balanceItem.balanceItem.registration
                        } : undefined,
                    })
                ],
                animated: true
            })
        } catch (e) {
            this.errorBox = new ErrorBox(e as Error)
        }
        this.saving = false;
    }

    async downloadUntil(arr: PaymentGeneral[], params: { afterId?: string, paidSince?: number } = {}) {
        const limit = 100
        
        const session = this.$context

        const response = await session.authenticatedServer.request({
            method: "GET",
            query: {
                methods: this.methods.join(','),
                providers: [...this.providers, 'null'].join(','),
                paidSince: this.correctedStartDate.getTime(),
                paidBefore: this.correctedEndDate.getTime(),
                limit,
                ...params
            },
            path: "/organization/payments",
            decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
            owner: this
        })
        arr.push(...response.data)
    
        if (response.data.length === limit) {
            const last = response.data[response.data.length - 1]

            if (!last.paidAt) {
                throw new Error("Missing paidAt")
            }

            // Download next page
            await this.downloadUntil(arr, {
                afterId: last.id,
                paidSince: last.paidAt.getTime(),
            })
        }
    }
}
</script>