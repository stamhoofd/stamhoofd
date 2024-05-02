<template>
    <div class="st-view background invoice-view">
        <STNavigationBar :title="invoice.number ? 'Factuur '+invoice.number : 'Proforma factuur'" />

        <main>
            <h1 v-if="!invoice.number">
                Proforma factuur
            </h1>
            <h1 v-else>
                Factuur {{ invoice.number }} [KOPIE]
            </h1>
            <p v-if="!invoice.number">
                Er wordt op het einde van de maand een factuur opgemaakt zodra het bedrag groter is dan 5 euro of als alle pakketten worden stopgezet.
            </p>
            <p v-else class="error-box">
                Dit is geen officiële factuur. Download de PDF zodra die beschikbaar is.
            </p>

            <p v-if="invoice.invoice" class="info-box selectable with-button" @click="checkStatus">
                Een (deel) van de betaling van deze factuur is in behandeling. Dit kan tot 3 werkdagen duren. Je kan in tussentijd zelf niet de betaling in orde brengen (om dubbele betaling te voorkomen). Gestart op: {{ formatDateTime(invoice.invoice.createdAt) }}

                <button class="button text">
                    Checken
                </button>
            </p>

            <p v-if="!invoice.number && isPaymentFailed" class="error-box selectable with-button">
                De betaling via domiciliëring/kredietkaart is {{ paymentFailedCount }} keer mislukt, eerste keer op {{ formatDateTime(paymentFailedDate) }}.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem v-for="item in invoice.meta.items" :key="item.id">
                    <template #left>
                        {{ item.amount }}x
                    </template>

                    <h3 class="style-title-list">
                        {{ item.name }}
                    </h3>
                    <p class="style-description">
                        {{ item.description }}
                    </p>

                    <template #right>
                        {{ formatPrice(item.price) }}

                        <button v-if="!invoice.number" class="button icon trash" type="button" @click="deleteItem(item)" />
                    </template>
                </STListItem>
            </STList>

            <div class="pricing-box">
                <STList>
                    <STListItem>
                        Prijs excl. BTW

                        <template #right>
                            {{ formatPrice(invoice.meta.priceWithoutVAT) }}
                        </template>
                    </STListItem>

                    <STListItem>
                        BTW ({{ invoice.meta.VATPercentage }}%)
    
                        <template #right>
                            {{ formatPrice(invoice.meta.VAT) }}
                        </template>
                    </STListItem>

                    <STListItem>
                        Te betalen

                        <template #right>
                            {{ formatPrice(invoice.meta.priceWithVAT) }}
                        </template> 
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" :disabled="invoice.invoice" @click="charge">
                        Afrekenen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, ErrorBox, LoadingButton,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { NetworkManager } from "@stamhoofd/networking";
import { PaymentStatus, STInvoice, STInvoiceItem, STInvoiceMeta, STInvoicePrivate, STPendingInvoice, STPendingInvoicePrivate } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STList,
        STListItem,
        LoadingButton
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    }
})
export default class InvoiceView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        invoice: STInvoicePrivate | STPendingInvoicePrivate

    errorBox: ErrorBox | null = null
    validator = new Validator()

    loading = false

    get isPaymentFailed() {
        return this.paymentFailedCount > 0
    }

    get paymentFailedCount() {
        let d = 0
        for (const item of this.invoice.meta.items) {
            if (!item.package || item.package.meta.paymentFailedCount === 0) {
                continue
            }
            d = Math.max(d, item.package.meta.paymentFailedCount)
        }
        return d
    }

    get paymentFailedDate() {
        let d: Date | null = null
        for (const item of this.invoice.meta.items) {
            if (!item.package || item.package.meta.firstFailedPayment === null) {
                continue
            }
            if (d === null || d > item.package.meta.firstFailedPayment) {
                d = item.package.meta.firstFailedPayment
            }

        }
        return d
    }

    async charge() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            await AdminSession.shared.authenticatedServer.request({
                method: "POST",
                path: "/organizations/"+this.invoice.organization!.id+"/charge",
            })
            this.dismiss({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async deleteItem(item: STInvoiceItem) {
        if (!(this.invoice instanceof STPendingInvoicePrivate)) {
            return
        }

        if (!this.invoice.id) {
            return
        }

        const metaPatch = STInvoiceMeta.patch({})
        metaPatch.items.addDelete(item.id)

        const patch = STPendingInvoice.patch({
            meta: metaPatch
        })

        try {
            const response = await AdminSession.shared.authenticatedServer.request({
                method: "PATCH",
                body: patch,
                path: "/pending-invoices/"+this.invoice.id,
                decoder: STPendingInvoice as Decoder<STPendingInvoice>,
            })
            this.invoice.set(response.data)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async checkStatus() {
        if (!(this.invoice instanceof STPendingInvoicePrivate)) {
            return
        }

        if (!this.invoice.invoice || !this.invoice.invoice.payment) {
            return
        }

        const payment = await this.poll(this.invoice.invoice.payment.id)

        if (payment?.status === PaymentStatus.Succeeded) {
            new CenteredMessage("Gelukt", "De betaling is ondertussen gelukt").addCloseButton().show()
        } else if (payment?.status === PaymentStatus.Failed) {
            new CenteredMessage("Mislukt", "De betaling is ondertussen mislukt").addCloseButton().show()
        } else {
            new CenteredMessage("Nog in verwerking", "De betaling is nog in verwerking").addCloseButton().show()
        }
        
    }

    async poll(paymentId: string) {
        const response = await NetworkManager.server
            .request({
                method: "POST",
                path: "/billing/payments/" +paymentId,
                decoder: STInvoice as Decoder<STInvoice>,
            })
        return response.data.payment
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.invoice-view {
    > main {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }
}
</style>