<template>
    <div class="st-view background invoice-details-view">
        <STNavigationBar :title="invoice.number ? 'Factuur '+invoice.number : 'Proforma factuur'">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

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

            <p v-if="invoice.invoice" class="info-box">
                Een (deel) van de betaling van deze proforma factuur is in behandeling. Dit kan tot 3 werkdagen duren. Je kan in tussentijd zelf niet de betaling in orde brengen (om dubbele betaling te voorkomen). Gestart op: {{ invoice.invoice.createdAt | dateTime }}
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <STList>
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

            <div class="pricing-box">
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
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { STInvoice, STPendingInvoice } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import InvoicePaymentStatusView from "./InvoicePaymentStatusView.vue";

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
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.invoice-details-view {
    > main {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .pricing-box {
        margin-top: auto;
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        justify-content: flex-end;

        > * {
            flex-basis: 500px;
        }

        .middle {
            font-weight: 600;
        }
    }
}
</style>