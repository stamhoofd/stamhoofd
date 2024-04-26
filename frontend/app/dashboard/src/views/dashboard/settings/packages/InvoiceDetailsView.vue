<template>
    <div class="st-view background invoice-details-view">
        <STNavigationBar :title="invoice.number ? 'Factuur '+invoice.number : 'Proforma factuur'" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <template v-if="!invoice.number">
                <h1 v-if="!isPaymentFailed">
                    Volgende aanrekening
                </h1>
                <h1 v-else>
                    Openstaand bedrag
                </h1>
            </template>
            <h1 v-else>
                Factuur {{ invoice.number }} [KOPIE]
            </h1>
            <p v-if="!invoice.number && !isPaymentFailed">
                Er wordt op het einde van de maand een factuur opgemaakt zodra het bedrag groter is dan 5 euro of als alle pakketten worden stopgezet.
            </p>
            <p v-else-if="!invoice.number" class="warning-box">
                Eén of meerdere betalingen is mislukt. Betaal het openstaande bedrag om te voorkomen dat bepaalde functies worden uitgeschakeld.
            </p>
            <p v-else class="error-box">
                Dit is geen officiële factuur. Download de PDF zodra die beschikbaar is.
            </p>

            <p v-if="invoice.invoice" class="info-box">
                Een (deel) van de betaling van deze proforma factuur is in behandeling. Dit kan tot 3 werkdagen duren. Je kan in tussentijd zelf niet de betaling in orde brengen (om dubbele betaling te voorkomen). Gestart op: {{ invoice.invoice.createdAt | dateTime }}
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <p v-if="!invoice.number && invoice.meta.items.length == 0" class="info-box">
                Geen openstaand bedrag.
            </p>

            <STList v-if="invoice.meta.items.length">
                <STListItem v-for="item in invoice.meta.items" :key="item.id">
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

            <div v-if="invoice.meta.items.length" class="pricing-box">
                <STList>
                    <STListItem>
                        Prijs excl. BTW

                        <template slot="right">
                            {{ invoice.meta.priceWithoutVAT | price }}
                        </template>
                    </STListItem>

                    <STListItem>
                        BTW ({{ invoice.meta.VATPercentage }}%)
    
                        <template slot="right">
                            {{ invoice.meta.VAT | price }}
                        </template>
                    </STListItem>

                    <STListItem>
                        Te betalen

                        <template slot="right">
                            {{ invoice.meta.priceWithVAT | price }}
                        </template> 
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar v-if="!invoice.number && invoice.meta.priceWithVAT > 0">
            <template slot="right">
                <button class="button primary" :disabled="invoice.invoice" type="button" @click="charge">
                    Afrekenen
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { STInvoice, STPendingInvoice } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";


import PackageConfirmView from "./PackageConfirmView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STList,
        STListItem
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    }
})
export default class InvoiceDetailsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        invoice: STInvoice | STPendingInvoice

    errorBox: ErrorBox | null = null
    validator = new Validator()

    charge() {
        this.show(new ComponentWithProperties(PackageConfirmView))
    }

    get organization() {
        return this.$organization
    }

    get paymentFailedDeactivateDate() {
        let d: Date | null = null
        for (const [_, pack] of this.organization.meta.packages.packages) {
            if (pack.deactivateDate === null || pack.firstFailedPayment === null) {
                continue
            }
            if (d && d < pack.deactivateDate) {
                continue
            }
            d = pack.deactivateDate
        }
        return d
    }
    
    get isPaymentFailed() {
        return this.paymentFailedDeactivateDate !== null && this.invoice.meta.items.length > 0
    }
}
</script>
