<template>
    <TableView ref="table" :organization="organization" :title="title" :default-sort-column="defaultSortColumn" :default-sort-direction="defaultSortDirection" column-configuration-id="transfer-payments" :actions="actions" :all-values="payments" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" @click="openPayment">
        <p class="style-description">
            Als je de betaalmethode 'overschrijven' gebruikt, kan je hier aangeven welke betalingen je hebt ontvangen (overschrijvingen die als betaald werden gemarkeerd blijven daarna nog 7 dagen zichtbaar).
        </p>
        <template #empty>
            Er zijn nog geen overschrijvingen.
        </template>
    </TableView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { CenteredMessage, Column, GlobalEventBus, InMemoryTableAction, LoadComponent, PaymentView, TableAction, TableView, Toast } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { Filter, FilterDefinition, Payment, PaymentGeneral, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";

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
        return this.$organization
    }

    mounted() {
        this.loading = true

        this.loadPayments().catch((e) => {
            console.error(e)
        }).finally(() => {
            this.loading = false
        })

        UrlHelper.setUrl("/finances/transfers")
        document.title = "Stamhoofd - Overschrijvingen"
    }

    get estimatedRows() {
        if (this.loading) {
            return this.payments.length == 0 ? 30 : this.payments.length
        }
       
        return 0
    }

    openPayment(payment: PaymentGeneral) {
        const table = this.$refs.table as TableView<PaymentGeneral> | undefined
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PaymentView, {
                initialPayment: payment,
                getNext: table?.getNext,
                getPrevious: table?.getPrevious
            }),
        });

        if ((this as any).$isMobile) {
            this.show(component)
        } else {
            component.modalDisplayStyle = "popup";
            this.present(component);
        }
    }

    get actions(): TableAction<PaymentGeneral>[] {
        return [
            new InMemoryTableAction({
                name: "Markeer als betaald",
                icon: "success",
                priority: 2,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (payments: PaymentGeneral[]) => {
                    // Mark paid
                    await this.markPaid(payments, true)
                }
            }),
            new InMemoryTableAction({
                name: "Markeer als niet betaald",
                icon: "canceled",
                priority: 1,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (payments: PaymentGeneral[]) => {
                    // Mark paid
                    await this.markPaid(payments, false)
                }
            }),

            new InMemoryTableAction({
                name: "E-mailen",
                icon: "email",
                priority: 0,
                groupIndex: 2,
                allowAutoSelectAll: false,
                
                handler: async (payments: PaymentGeneral[]) => {
                    await this.mail(payments)
                }
            }),

            new InMemoryTableAction({
                name: "Exporteren",
                icon: "download",
                priority: 0,
                groupIndex: 2,
                allowAutoSelectAll: true,
                
                handler: async (payments: PaymentGeneral[]) => {
                    await this.downloadExcel(payments)
                }
            }),
        
            new InMemoryTableAction({
                name: "SMS'en",
                icon: "feedback-line",
                priority: 0,
                groupIndex: 2,
                allowAutoSelectAll: false,

                handler: async (payments: PaymentGeneral[]) => {
                    await this.sms(payments)
                }
            }),
        ]
    }

    async sms(payments: PaymentGeneral[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ "../sms/SMSView.vue"), {
            customers: payments.flatMap(p => p.orders.map(o => o.data.customer)),
            members: payments.flatMap(p => p.members)
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    async mail(payments: PaymentGeneral[]) {
        // Needs change
        // const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "MailView" */ "../mail/MailView.vue"), {
        //     payments,
        //     defaultReplacements: this.$organization.meta.getEmailReplacements()
        // });
        // this.present(displayedComponent.setDisplayStyle("popup"));
    }

    async downloadExcel(payments: PaymentGeneral[]) {
        try {
            const d = await import(/* webpackChunkName: "PaymentsExcelExport" */ "../../../classes/PaymentsExcelExport");
            const PaymentsExcelExport = d.PaymentsExcelExport
            const instance = new PaymentsExcelExport({
                webshops: this.organization.webshops,
                stripeAccounts: [], // Not required because we only export transfers
                groups: this.organization.groups
            })
            instance.export(payments);
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    get filterDefinitions(): FilterDefinition<PaymentGeneral, Filter<PaymentGeneral>, any>[] {
        return []
    }

    allColumns = ((): Column<PaymentGeneral, any>[] => {
        const cols: Column<PaymentGeneral, any>[] = [
            new Column<PaymentGeneral, string>({
                name: "Naam", 
                getValue: (payment) => {
                    const names = [...payment.orders.map(o => o.data.customer), ...payment.members.map(r => r.details)]
                    return Formatter.groupNamesByFamily(names)
                }, 
                getStyle: (name) => name == "" ? "gray" : "",
                format: (name) => name == "" ? "Onbekend" : name,
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 50,
                recommendedWidth: 100
            }),

            new Column<PaymentGeneral, string>({
                name: "Beschrijving", 
                getValue: (payment) => {
                    return payment.balanceItemPayments.map(bip => bip.balanceItem.description).join(", ")
                }, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 50,
                recommendedWidth: 200,
                enabled: false
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

            new Column<PaymentGeneral, string | null>({
                name: "Mededeling", 
                getValue: (payment) => payment.transferDescription, 
                compare: (a, b) => Sorter.byStringValue(a ?? "", b ?? ""),
                format: (value) => value ?? "Geen",
                getStyle: (value) => value === null ? "gray" : "",
                minimumWidth: 50,
                recommendedWidth: 180
            }),

            new Column<PaymentGeneral, number>({
                name: "Bedrag", 
                getValue: (payment) => payment.price, 
                compare: (a, b) => Sorter.byNumberValue(b, a),
                format: (value) => Formatter.price(value),
                minimumWidth: 50,
                recommendedWidth: 50
            }),

            new Column<PaymentGeneral, PaymentStatus>({
                name: "Status", 
                getValue: (payment) => payment.status,
                compareObjects: (a, b) => {
                    return Sorter.stack(Sorter.byBooleanValue(a.status === PaymentStatus.Succeeded, b.status === PaymentStatus.Succeeded), Sorter.byDateValue(b.createdAt, a.createdAt))
                },
                format: (status) => {
                    if (status === PaymentStatus.Succeeded) {
                        return "Betaald"
                    }
                    if (status === PaymentStatus.Failed) {
                        return "Geannuleerd"
                    }
                    return "Niet betaald"
                },
                getStyle: (status) => status === PaymentStatus.Succeeded ? "success" : (status === PaymentStatus.Failed ? "gray" : "error"),
                minimumWidth: 60,
                recommendedWidth: 70,
            }),
        ]

        return cols
    })()

    get defaultSortColumn() {
        return this.allColumns[5]
    }

    get defaultSortDirection() {
        return "DESC"
    }

    async loadPayments() {
        const session = this.$context
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/payments",
            decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
            owner: this,
        })

        this.setPayments(response.data)
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    setPayments(setPayments: PaymentGeneral[], add = false) {
        setPayments = setPayments.filter(p => p.method == PaymentMethod.Transfer)

        // Decrypt data
        const payments: PaymentGeneral[] = []
        for (const payment of setPayments) {
            if (add) {
                const pp = this.payments.find(p => p.id == payment.id)
                if (pp) {
                    // Keep reference
                    pp.deepSet(payment)
                } else {
                    // Append
                    payments.push(payment)
                }
            } else {
                payments.push(payment)
            }
        }

        if (add) {
            this.payments.push(...payments)
        } else {
            this.payments = payments
        }
    }

    async markPaid(payments: PaymentGeneral[], paid = true) {
        const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray()
        let hasOrder = false

        for (const payment of payments) {
            if (payment.orders.length > 0) {
                hasOrder = true
            }
            if (paid) {
                if (payment.status != PaymentStatus.Succeeded) {
                    data.addPatch(Payment.patch({
                        id: payment.id,
                        status: PaymentStatus.Succeeded
                    }))
                }
            } else {
                if (payment.status == PaymentStatus.Succeeded) {
                    data.addPatch(Payment.patch({
                        id: payment.id,
                        status: PaymentStatus.Created,
                    }))
                }
            }
            
        }
        
        if (data.changes.length > 0) {
            if (!await CenteredMessage.confirm("Ben je zeker?", paid ? "Markeer als betaald" : "Markeer als niet betaald", paid && hasOrder ? "De besteller(s) van bestellingen ontvangen een automatische e-mail." : undefined)) {
                return;
            }
            const session = this.$context

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                    shouldRetry: false
                })

                this.setPayments(response.data, true)
                new Toast("Betaalstatus gewijzigd", "success").setHide(1000).show()

                for (const payment of response.data) {
                    GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
                }
            } catch (e) {
                Toast.fromError(e).show()
            }
        } else {
            new Toast(paid ? "Al gemarkeerd als betaald" : ("Deze "+ (payments.length == 1 ? "betaling werd" : "betalingen werden") +" nog niet betaald"), "error red").setHide(1500).show()
        }
    }
}
</script>
