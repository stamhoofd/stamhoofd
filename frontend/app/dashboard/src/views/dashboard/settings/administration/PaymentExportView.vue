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
                <h3 class="style-title-list">
                    {{ detail.name }}
                </h3>
                <p v-if="detail.description" class="style-description-small pre-wrap" v-text="detail.description" />

                <template #right>
                    {{ formatPrice(detail.price) }}
                </template>
                <template v-if="detail.filter" #right><span class="icon arrow-right-small gray" /></template>
            </STListItem>
        </STList>

        <STList v-if="tab === 'account'">
            <STListItem v-for="detail in accountDetails" :key="detail.id" :selectable="!!detail.filter" class="right-stack" @click="openFilter(detail)">
                <h3 class="style-title-list">
                    {{ detail.name }}
                </h3>
                <p v-if="detail.description" class="style-description-small pre-wrap" v-text="detail.description" />

                <template #right>
                    {{ formatPrice(detail.price) }}
                </template>
                <template v-if="detail.filter" #right><span class="icon arrow-right-small gray" /></template>
            </STListItem>
        </STList>

        <STList v-if="tab === 'order'">
            <STListItem v-for="detail in orderDetails" :key="detail.id" :selectable="!!detail.filter" class="right-stack" @click="openFilter(detail)">
                <h3 class="style-title-list">
                    <template v-if="detail.count">
                        {{ detail.count }} ×
                    </template>{{ detail.name }}
                </h3>
                <p v-if="detail.description" class="style-description-small pre-wrap" v-text="detail.description" />

                <template #right>
                    {{ formatPrice(detail.price) }}
                </template>
                <template v-if="detail.filter" #right><span class="icon arrow-right-small gray" /></template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, DateSelection, LoadingButton,SaveView, SegmentedControl,STErrorsDefault, STInputBox, STList, STListItem, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { BalanceItemPaymentDetailed, calculateVATPercentage, PaymentMethod, PaymentMethodHelper, PaymentProvider, StripeAccount } from "@stamhoofd/structures";
import { PaymentGeneral } from "@stamhoofd/structures";
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

export type PaymentFilter = {
    filterBalanceItems?: (payment: BalanceItemPaymentDetailed) => boolean
    filterPayments?: (payment: PaymentGeneral) => boolean
};

class Detail {
    id: string;
    name: string;
    description?: string;
    price: number;
    count?: number;
    filter?: PaymentFilter
    
    constructor({id, name, description, price, filter, count}: {id: string, count?: number, name: string, description?: string, price: number, filter?: PaymentFilter}) {
        this.id = id
        this.name = name
        this.description = description
        this.price = price
        this.filter = filter
        this.count = count
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
    orderDetails: Detail[] = []

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

        if (this.orderDetails.length > 0) {
            // Also show when only 1
            tabs.push({id: "order", label: "Artikels"})
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
        this.buildOrderDetails()

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

                let id = bp.balanceItem.description
                let name = bp.balanceItem.description ?? "Onbekend"
                let description = ""
                let filter;

                const balanceItem = bp.balanceItem;
                const price = bp.price;

                if (balanceItem.order) {
                    id = balanceItem.order.webshopId
                    name = this.organization.webshops.find(w => w.id === id)?.meta?.name ?? id
                    filter = {
                        filterBalanceItems: (b: BalanceItemPaymentDetailed) => {
                            if (b.balanceItem.order) {
                                return b.balanceItem.order.webshopId === id
                            }
                            return false;
                        }
                    }
                } else if (balanceItem.registration) {
                    const groupId = balanceItem.registration.groupId
                    const cycle = balanceItem.registration.cycle

                    id = groupId + ':' + cycle

                    const group = this.organization.groups.find(g => g.id === groupId);
                    const groupName = group?.settings.name ?? groupId
                    const cyclePeriod = group?.getTimeRange(balanceItem.registration.cycle) ?? ""

                    name = !group ? (balanceItem.description || 'Onbekende inschrijving (verwijderde groep)') : ("Inschrijving " + groupName);
                    description = !group ? 'Verwijderde groep' : cyclePeriod;

                    filter = {
                        filterBalanceItems: (b: BalanceItemPaymentDetailed) => {
                            if (b.balanceItem.registration) {
                                return b.balanceItem.registration.groupId === groupId && b.balanceItem.registration.cycle === cycle
                            }
                            return false;
                        }
                    }
                } else {
                    filter = {
                        filterBalanceItems: (b: BalanceItemPaymentDetailed) => {
                            return b.balanceItem.description === id
                        }
                    }
                }

                if (!details.has(id)) {                    
                    details.set(id, new Detail({
                        id,
                        name,
                        description,
                        price: 0,
                        filter
                    }))
                }
                const detail = details.get(id)!
                detail.price += price
            }
        }

        this.typeDetails = [
            ...details.values(),
        ].sort((a, b) => Sorter.byNumberProperty(a, b, "price"))
    }

    buildOrderDetails() {
        const details = new Map<string, Detail>()
        
        for (const payment of this.payments) {
            // If it is for an order, group by webshops
            for (const bp of payment.balanceItemPayments) {
                if (!this.doesMatchFilter(bp)) {
                    continue;
                }

                const balanceItem = bp.balanceItem;

                if (!balanceItem.order) {
                    // Order details not available: should all be related to an order
                    return [];
                }

                if (bp.price !== balanceItem.order.data.totalPrice) {
                    let id = bp.price < 0 ? 'reimbured-order' : 'edited-order'
                    let name = bp.price < 0 ? 'Terugbetaling bestelling' : 'Gewijzigde bestelling'
                    let description = ''

                    if (!details.has(id)) {                    
                        details.set(id, new Detail({
                            id,
                            name,
                            description,
                            price: 0,
                            count: 0
                        }))
                    }
                    const detail = details.get(id)!
                    detail.price += bp.price ?? 0
                    detail.count = (detail.count ?? 0) + 1

                    continue;
                }

                for (const item of balanceItem.order.data.cart.items) {
                    let id = item.code
                    let name = item.product.name
                    let description = item.description

                    if (!details.has(id)) {                    
                        details.set(id, new Detail({
                            id,
                            name,
                            description,
                            price: 0,
                            count: 0
                        }))
                    }
                    const detail = details.get(id)!
                    detail.price += item.price ?? 0
                    detail.count = (detail.count ?? 0) + item.amount
                }

                // Delivery price
                if (balanceItem.order.data.deliveryPrice) {
                    let id = "delivery-price"
                    let name = "Leveringskost"
                    let description = ""

                    if (!details.has(id)) {                    
                        details.set(id, new Detail({
                            id,
                            name,
                            description,
                            price: 0,
                            count: 0
                        }))
                    }
                    const detail = details.get(id)!
                    detail.price += balanceItem.order.data.deliveryPrice
                    detail.count = (detail.count ?? 0) + 1
                }

                // Administratie price
                if (balanceItem.order.data.administrationFee) {
                    let id = "administration-price"
                    let name = "Administratiekosten"
                    let description = ""

                    if (!details.has(id)) {                    
                        details.set(id, new Detail({
                            id,
                            name,
                            description,
                            price: 0,
                            count: 0
                        }))
                    }
                    const detail = details.get(id)!
                    detail.price += balanceItem.order.data.administrationFee
                    detail.count = (detail.count ?? 0) + 1
                }
            }
        }

        this.orderDetails = [
            ...details.values(),
        ].sort((a, b) => Sorter.byNumberProperty(a, b, "price"))
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