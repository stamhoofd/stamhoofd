<template>
    <TableView ref="table" :organization="organization" :title="title" column-configuration-id="transfer-payments" :actions="actions" :all-values="payments" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions">
        <p class="style-description">
            Overzicht van alle openstaande overschrijvingen (overschrijvingen die als betaald werden gemarkeerd blijven daarna nog 1 maand zichtbaar).
        </p>
        <template #empty>
            Er zijn nog geen overschrijvingen.
        </template>
    </TableView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Column, TableAction, TableView } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { EncryptedPaymentGeneral, Filter, FilterDefinition, PaymentGeneral, PaymentMethod } from '@stamhoofd/structures';
import { PaymentStatus } from "@stamhoofd/structures/esm/dist";
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";

@Component({
    components: {
        TableView,
    },
})
export default class TransferPaymentsView extends Mixins(NavigationMixin) {
    loading = false;
    payments: PaymentGeneral[] = []

    get title() {
        return "Overschrijvingen"
    }

    get organization() {
        return OrganizationManager.organization
    }

    mounted() {
        this.loading = true

        this.loadPayments().catch((e) => {
            console.error(e)
        }).finally(() => {
            this.loading = false
        })

        UrlHelper.setUrl("/transfers")
        document.title = "Stamhoofd - Overschrijvingen"
    }

    get estimatedRows() {
        if (this.loading) {
            return this.payments.length == 0 ? 30 : this.payments.length
        }
       
        return 0
    }

    get actions(): TableAction<PaymentGeneral>[] {
        return [
            new TableAction({
                name: "Markeer als betaald",
                icon: "success",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: (orders: PaymentGeneral[]) => {
                    // Mark paid
                }
            })
        ]
    }

    get filterDefinitions(): FilterDefinition<PaymentGeneral, Filter<PaymentGeneral>, any>[] {
        return []
    }

    allColumns = ((): Column<PaymentGeneral, any>[] => {
        const cols: Column<PaymentGeneral, any>[] = [
            new Column<PaymentGeneral, string>({
                name: "Naam", 
                getValue: (payment) => payment.order ? payment.order.data.customer.name : payment.registrations.map(r => r.member.name).join(", "), 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 50,
                recommendedWidth: 100
            }),

            new Column<PaymentGeneral, Date>({
                name: "Datum", 
                getValue: (payment) => payment.createdAt,
                compare: (a, b) => Sorter.byDateValue(b, a),
                format: (date, width: number) => {
                    if (width < 120) {
                        return Formatter.dateNumber(date, false)
                    }

                    if (width < 170) {
                        return Formatter.capitalizeFirstLetter(Formatter.date(date))
                    }
                    return Formatter.capitalizeFirstLetter(Formatter.date(date, true))
                },
                minimumWidth: 60,
                recommendedWidth: 70,
            }),

            new Column<PaymentGeneral, number>({
                name: "Bedrag", 
                getValue: (payment) => payment.price, 
                compare: (a, b) => Sorter.byNumberValue(b, a),
                format: (value) => Formatter.price(value),
                minimumWidth: 50,
                recommendedWidth: 50
            }),

            new Column<PaymentGeneral, string | null>({
                name: "Mededeling", 
                getValue: (payment) => payment.transferDescription, 
                compare: (a, b) => Sorter.byStringValue(a ?? "", b ?? ""),
                format: (value) => value ?? "Geen",
                getStyle: (value) => value === null ? "gray" : "",
                minimumWidth: 50,
                recommendedWidth: 50
            }),

            new Column<PaymentGeneral, PaymentStatus>({
                name: "Status", 
                getValue: (payment) => payment.status,
                compare: (a, b) => Sorter.byEnumValue(a, b, PaymentStatus),
                format: (status) => {
                    if (status === PaymentStatus.Succeeded) {
                        return "Betaald"
                    }
                    return "Niet betaald"
                },
                getStyle: (status) => status === PaymentStatus.Succeeded ? "success" : "error",
                minimumWidth: 60,
                recommendedWidth: 70,
            }),

            new Column<PaymentGeneral, string>({
                name: "Beschrijving", 
                getValue: (payment) => {
                    if (!payment.order) {
                        return payment.registrations.map(r => r.group.settings.name).join(", ")
                    }
                    const webshop = this.organization.webshops.find(w => w.id == payment.order!.webshopId)
                    if (webshop) {
                        return webshop.meta.name+" #"+payment.order.number
                    }
                    return "#"+payment.order.number
                }, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 50,
                recommendedWidth: 100
            }),

        ]

        return cols
    })()

    async loadPayments() {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/payments",
            decoder: new ArrayDecoder(EncryptedPaymentGeneral as Decoder<EncryptedPaymentGeneral>),
            owner: this,
        })

        await this.setPayments(response.data)
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

    async setPayments(encryptedPayments: EncryptedPaymentGeneral[]) {
        encryptedPayments = encryptedPayments.filter(p => p.method == PaymentMethod.Transfer)
        const organization = OrganizationManager.organization

        // Decrypt data
        const payments: PaymentGeneral[] = []
        for (const encryptedPayment of encryptedPayments) {
            // Create a detailed payment without registrations
            const payment = PaymentGeneral.create({
                ...encryptedPayment, 
                registrations: await MemberManager.decryptRegistrationsWithMember(encryptedPayment.registrations, organization.groups, organization)
            })

            // Set payment reference
            for (const registration of payment.registrations) {
                registration.payment = payment
            }

            payments.push(payment)
        }

        this.payments = payments
    }
}
</script>