<template>
    <SaveView :loading="exporting" :title="title" :disabled="false" save-text="Exporteren" save-icon="download" cancel-text="Sluiten" @save="downloadExcel">
        <h1 class="style-navigation-title">
            {{ title }} <span class="title-suffix">
                {{ count }}
            </span>
        </h1>

        <p v-if="!filterBalanceItems && totalNotPaidOut === 0 && hasOnlinePaymentsWithSettlements" class="success-box">
            Alle online betalingen werden reeds uitbetaald door de betaalprovider
        </p>

        <STList class="info">
            <STListItem>
                <h3 class="style-definition-label">
                    Totaalbedrag
                </h3>
                <p class="style-definition-text">
                    {{ formatPrice(totalPrice) }}
                </p>
            </STListItem>

            <STListItem v-if="totalTransferFee">
                <h3 class="style-definition-label">
                    Transactiekost
                </h3>

                <p class="style-definition-text">
                    {{ formatPrice(totalTransferFee) }}
                </p>
                <p class="style-description-small">
                    <template v-if="VATPercentage > 0">
                        Incl. {{ VATPercentage }}% BTW —
                    </template> <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/transactiekosten-inhouding/'" class="inline-link" target="_blank">Meer info</a>
                </p>
            </STListItem>

            <STListItem v-if="totalNotPaidOut">
                <h3 class="style-definition-label">
                    Niet uitbetaald
                </h3>

                <p class="style-definition-text">
                    {{ formatPrice(totalNotPaidOut) }}
                </p>
                <p class="style-description-small">
                    Dit bedrag moet nog worden uitbetaald door de betaalprovider.
                </p>
            </STListItem>

            <STListItem v-if="typeDetails.length === 1 && filterBalanceItems">
                <h3 class="style-definition-label">
                    Voor
                </h3>
                <p class="style-definition-text">
                    {{ typeDetails[0].name }}
                </p>
                <p v-if="typeDetails[0].description" class="style-description-small">
                    {{ typeDetails[0].description }}
                </p>
            </STListItem>

            <STListItem v-if="accountDetails.length === 1">
                <h3 class="style-definition-label">
                    Betaald via
                </h3>
                <p class="style-definition-text">
                    {{ accountDetails[0].name }}
                </p>
                <p v-if="accountDetails[0].description" class="style-description-small">
                    {{ accountDetails[0].description }}
                </p>
            </STListItem>
        </STList>

        <hr v-if="tab">

        <SegmentedControl v-if="segmentedControlItems.length > 1" v-model="tab" :items="segmentedControlItems" :labels="segmentedControlLabels" class="with-margin" />

        <STList v-if="tab === 'type'">
            <STListItem v-for="detail in typeDetails" :key="detail.id" :selectable="!!detail.filter" class="right-stack" @click="openFilter(detail)">
                <template #left v-if="detail.amount !== undefined">
                    <span class="style-amount min-width">{{ formatFloat(detail.amount) }}</span>
                </template>

                <p class="style-title-prefix-list" v-if="detail.prefix">
                    {{ detail.prefix }}
                </p>

                <h3 class="style-title-list">
                    {{ detail.name }}
                </h3>
                <p v-if="detail.description" class="style-description-small pre-wrap" v-text="detail.description" />
                <p v-if="detail.unitPrice !== undefined" class="style-description-small">{{ formatPrice(detail.unitPrice) }}</p>

                <template #right>
                    <span class="style-price">{{ formatPrice(detail.price) }}</span>
                    <span v-if="detail.filter" class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <STList v-if="tab === 'account'">
            <STListItem v-for="detail in accountDetails" :key="detail.id" :selectable="!!detail.filter" class="right-stack" @click="openFilter(detail)">
                <h3 class="style-title-list">
                    {{ detail.name }}
                </h3>
                <p v-if="detail.description" class="style-description-small pre-wrap" v-text="detail.description" />

                <template #right>
                    <span class="style-price">{{ formatPrice(detail.price) }}</span>
                    <span v-if="detail.filter" class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Checkbox, DateSelection, LoadingButton, SaveView, SegmentedControl, STErrorsDefault, STInputBox, STList, STListItem, Toast, TooltipDirective } from "@stamhoofd/components";
import { BalanceItemPaymentDetailed, calculateVATPercentage, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentProvider, StripeAccount } from "@stamhoofd/structures";
import { Formatter, Sorter } from "@stamhoofd/utility";

export type PaymentFilter = {
    filterBalanceItems?: (payment: BalanceItemPaymentDetailed) => boolean
    filterPayments?: (payment: PaymentGeneral) => boolean
};

class Detail {
    id: string;
    prefix?: string;
    name: string;
    description?: string;

    unitPrice?: number;
    price: number;
    amount?: number;
    filter?: PaymentFilter
    
    constructor({id, prefix, name, description, price, filter, amount, unitPrice}: {id: string, prefix?: string, amount?: number, name: string, description?: string, unitPrice?: number, price: number, filter?: PaymentFilter}) {
        this.id = id
        this.prefix = prefix
        this.name = name
        this.description = description
        this.unitPrice = unitPrice
        this.price = price
        this.filter = filter
        this.amount = amount
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
        SegmentedControl,
        LoadingButton
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class PaymentExportView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        payments: PaymentGeneral[]

    @Prop({ required: true })
        stripeAccounts: StripeAccount[]

    @Prop({ default: null })
        filterBalanceItems: ((payment: BalanceItemPaymentDetailed) => boolean) | null

    @Prop({ default: null })
        filterTitle: string|null

    typeDetails: Detail[] = []
    accountDetails: Detail[] = []

    exporting = false

    tab = "account"

    get segmentedControlTabs() {
        const tabs: {id: string, label: string}[] = []

        if (this.accountDetails.length > 1) {
            tabs.push({id: "account", label: "Betaald via"})
        }

        if (this.typeDetails.length > 1) {
            tabs.push({id: "type", label: "Opsplitsing"})
        }

        return tabs
    }

    get segmentedControlItems() {
        return this.segmentedControlTabs.map(t => t.id)
    }

    get segmentedControlLabels() {
        return this.segmentedControlTabs.map(t => t.label)
    }

    get title() {
        if (this.filterTitle) {
            return this.filterTitle
        }
        if (this.filterBalanceItems) {
            if (this.typeDetails.length === 1) {
                return this.typeDetails[0].name
            }
        }
        return 'Betalingen'
    }

    get description() {
        if (this.typeDetails.length === 1) {
            return this.typeDetails[0].description
        }
        return ''
    }

    mounted() {
        this.buildTypeDetails()
        this.buildAccountDetails()

        this.tab = this.segmentedControlItems[0]
    }

    doesMatchFilter(balanceItem: BalanceItemPaymentDetailed) {
        if (this.filterBalanceItems) {
            return this.filterBalanceItems(balanceItem)
        }

        return true;
    }

    getPaymentFilteredPrice(payment: PaymentGeneral) {
        if (this.filterBalanceItems === null) {
            return payment.price
        }

        let total = 0
        for (const bp of payment.balanceItemPayments) {
            if (!this.doesMatchFilter(bp)) {
                continue;
            }
            total += bp.price
        }
        return total
    }

    async downloadExcel() {
        if (this.exporting) {
            return;
        }
        this.exporting = true
        try {
            const d = await import(/* webpackChunkName: "PaymentsExcelExport" */ "../../../../classes/PaymentsExcelExport");
            const PaymentsExcelExport = d.PaymentsExcelExport
            const instance = new PaymentsExcelExport({
                webshops: this.organization.webshops,
                stripeAccounts: this.stripeAccounts,
                groups: this.organization.groups,
                filterBalanceItems: this.filterBalanceItems
            })
            instance.export(this.filteredPayments);
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.exporting = false
    }

    get filteredPayments() {
        if (!this.filterBalanceItems) {
            return this.payments
        }
        return this.payments.filter(p => {
            if (this.filterBalanceItems) {
                // Remove payments without any matching items
                let itemCount = 0;

                for (const bp of p.balanceItemPayments) {
                    if (this.filterBalanceItems(bp)) {
                        itemCount++;
                        break;
                    }
                }

                if (itemCount === 0) {
                    return false;
                }
            } 
            return true;
        });
    }

    openFilter(detail: Detail) {
        const filter = detail.filter
        if (filter === undefined) {
            return;
        }

        const filterBalanceItems = filter.filterBalanceItems
        const currentFilter = this.filterBalanceItems

        this.present({
            components: [
                new ComponentWithProperties(PaymentExportView, {
                    stripeAccounts: this.stripeAccounts,
                    filterTitle: detail.name,
                    payments: filter.filterPayments ? this.filteredPayments.filter(p => {
                        if (filter.filterPayments) {
                            return filter.filterPayments(p)
                        }
                        return true;
                    }) : this.payments,
                    filterBalanceItems: filterBalanceItems ? ((b: BalanceItemPaymentDetailed) => {
                        return filterBalanceItems(b) && (currentFilter ? currentFilter(b) : true)
                    }) : currentFilter
                })
            ],
            animated: true,
            modalDisplayStyle: "popup"
        })
    }

    buildTypeDetails() {
        const details = new Map<string, Detail>()
        
        for (const payment of this.payments) {
            // If it is for an order, group by webshops
            for (const bp of payment.balanceItemPayments) {
                if (!this.doesMatchFilter(bp)) {
                    continue;
                }

                const id = bp.groupCode
                const price = bp.price;
                
                const filter = {
                    filterBalanceItems: (b: BalanceItemPaymentDetailed) => {
                        return b.groupCode === id
                    }
                }

                if (!details.has(id)) {                    
                    details.set(id, new Detail({
                        id,
                        prefix: bp.groupPrefix,
                        name: bp.groupTitle,
                        description: bp.groupDescription ?? undefined,
                        unitPrice: bp.unitPrice,
                        price: 0, // todo,
                        amount: 0, // todo
                        filter
                    }))
                }
                const detail = details.get(id)!
                detail.price += price
                detail.amount = (detail.amount ?? 0) + bp.amount
            }
        }

        this.typeDetails = [
            ...details.values(),
        ].sort((a, b) => Sorter.byStringProperty(a, b, "id"))
    }

    buildAccountDetails() {
        const accountDetails = new Map<string, Detail>()

        for (const payment of this.payments) {
            let filteredPrice = this.getPaymentFilteredPrice(payment)
            if (filteredPrice === 0) {
                continue;
            }

            let id: string = payment.provider ?? payment.method
            let name: string = payment.provider ?? PaymentMethodHelper.getNameCapitalized(payment.method)
            let description = payment.provider ? "Rekening die gekoppeld werd aan deze betaalprovider" : ""

            if (payment.provider === PaymentProvider.Stripe) {
                // todo: include ID
                const stripeAccount = this.stripeAccounts.find(a => a.id === payment.stripeAccountId)

                if (!stripeAccount) {
                    id = 'stripe-'+(payment.stripeAccountId ?? "unknown")
                    description = 'Verwijderd Stripe account (info ontbreekt)'
                } else {
                    id = 'stripe-'+stripeAccount.id
                    description = `xxxx ${stripeAccount.meta.bank_account_last4} (${stripeAccount.meta.business_profile?.name || stripeAccount.meta.company?.name || stripeAccount.meta.bank_account_bank_name})`
                }
            }

            if (payment.transferSettings && payment.method === PaymentMethod.Transfer) {
                id = Formatter.fileSlug(payment.transferSettings.iban ?? "Onbekend")
                name = "Overschrijving " + (payment.transferSettings.creditor ?? payment.transferSettings.iban ?? "Onbekend")
                description = payment.transferSettings.creditor ? (payment.transferSettings.iban ?? "Onbekend rekeningsnummer") : ""
            }

            if (!accountDetails.has(id)) {
                accountDetails.set(id, new Detail({
                    id,
                    name,
                    description,
                    price: 0,
                    filter: {
                        filterPayments: (p) => {
                            let pid: string = p.provider ?? p.method
                            if (p.transferSettings && p.method === PaymentMethod.Transfer) {
                                pid = Formatter.fileSlug(p.transferSettings.iban ?? "Onbekend")
                            }
                            if (p.provider === PaymentProvider.Stripe) {
                                pid = 'stripe-'+(p.stripeAccountId ?? "unknown")
                            }
                            
                            return pid === id
                        }
                    }
                }))
            }
            const detail = accountDetails.get(id)!
            detail.price += filteredPrice

            if (payment.transferSettings && payment.transferSettings.creditor && payment.method === PaymentMethod.Transfer) {
                detail.name = name
                detail.description = description
            }
        }

        this.accountDetails = [
            ...accountDetails.values()
        ].sort((a, b) => Sorter.byNumberProperty(a, b, "price"))
    }

    get VATPercentage() {
        return calculateVATPercentage(this.organization.meta.companyAddress ?? this.organization.address, this.organization.meta.VATNumber)
    }

    get organization() {
        return this.$context.organization!
    }

    get count() {
        return this.filteredPayments.length
    }

    get totalPrice() {
        let total = 0
        for (const payment of this.filteredPayments) {
            total += this.getPaymentFilteredPrice(payment)
        }
        return total
    }

    get totalTransferFee() {
        if (this.filterBalanceItems !== null) {
            // Not possible atm
            return 0
        }

        let total = 0
        for (const payment of this.payments) {
            total += payment.transferFee
        }
        return total
    }

    get totalNotPaidOut() {
        if (this.filterBalanceItems !== null) {
            // Not possible atm
            return 0
        }

        let total = 0
        for (const payment of this.payments) {
            if (payment.settlement) {
                continue;
            }
            if (payment.provider && [PaymentProvider.Stripe, PaymentProvider.Mollie].includes(payment.provider)) {
                total += payment.price - payment.transferFee
            }
        }
        return total
    }

    get hasOnlinePaymentsWithSettlements() {
        for (const payment of this.payments) {
            if (payment.provider && [PaymentProvider.Stripe, PaymentProvider.Mollie].includes(payment.provider)) {
                return true;
            }
        }
        return false;
    }

    save() {
        // todo
    }

    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }
}
</script>
