import { ArrayDecoder, AutoEncoderPatchType, Decoder } from "@simonbackx/simple-encoding"
import { CenteredMessage, LoadComponent, TableAction, Toast } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking"
import { EncryptedPaymentDetailed, OrderStatus, OrderStatusHelper, Payment, PaymentMethod, PaymentStatus, PrivateOrder } from "@stamhoofd/structures"

import { WebshopManager } from "../WebshopManager"

export class OrderActionBuilder {
    component: any
    webshopManager: WebshopManager

    constructor(settings: {
        component: any,
        webshopManager: WebshopManager
    }) {
        this.component = settings.component
        this.webshopManager = settings.webshopManager
    }

    getStatusActions() {
        return Object.values(OrderStatus).filter(s => s !== OrderStatus.Deleted).map(status => {
            return new TableAction({
                name: OrderStatusHelper.getName(status),
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markAs(orders, status)
                }
            })
        })
    }

    getPaymentActions() {
        return [
            new TableAction({
                name: "Betaald",
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markPaid(orders, true)
                }
            }),
            new TableAction({
                name: "Niet betaald",
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markPaid(orders, false)
                }
            })
        ]
    }

    getActions() {
        return [
            new TableAction({
                name: "Wijzig gegevens...",
                enabled: this.webshopManager.hasWrite,
                icon: "edit",
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                handler: async (orders: PrivateOrder[]) => {
                    await this.editOrder(orders[0])
                }
            }),

            new TableAction({
                name: "Wijzig status",
                enabled: this.webshopManager.hasWrite,
                icon: "flag",
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getStatusActions()
            }),

            new TableAction({
                name: "Wijzig betaalstatus",
                enabled: this.webshopManager.hasWrite,
                icon: "flag",
                priority: 0,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getPaymentActions()
            }),

            new TableAction({
                name: "E-mailen",
                icon: "email",
                priority: 10,
                groupIndex: 3,
                handler: async (orders: PrivateOrder[]) => {
                    await this.mail(orders)
                }
            }),
        
            new TableAction({
                name: "SMS'en",
                icon: "feedback-line",
                priority: 9,
                groupIndex: 3,

                handler: async (orders: PrivateOrder[]) => {
                    await this.sms(orders)
                }
            }),

            new TableAction({
                name: "Exporteer naar Excel",
                icon: "download",
                priority: 8,
                groupIndex: 3,
                handler: async (orders: PrivateOrder[]) => {
                    await this.exportToExcel(orders)
                }
            }),

            new TableAction({
                name: "Verwijderen",
                icon: "trash",
                enabled: this.webshopManager.hasWrite,
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.deleteOrders(orders)
                }
            })
        ]
    }

    async editOrder(order: PrivateOrder, mode?: "comments") {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "EditOrderView" */ "./EditOrderView.vue"), {
            initialOrder: order,
            webshopManager: this.webshopManager,
            mode
        });
        this.component.present(displayedComponent.setDisplayStyle("popup"));
    }

    async sms(orders: PrivateOrder[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ "../../sms/SMSView.vue"), {
            customers: orders.map(o => o.data.customer),
        });
        this.component.present(displayedComponent.setDisplayStyle("popup"));
    }

    async mail(orders: PrivateOrder[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "MailView" */ "../../mail/MailView.vue"), {
            defaultSubject: "Bestelling {{nr}}",
            orders: orders,
            webshop: this.webshopManager.preview
        });
        this.component.present(displayedComponent.setDisplayStyle("popup"));
    }

    async exportToExcel(orders: PrivateOrder[]) {
        const d = await import(/* webpackChunkName: "OrdersExcelExport" */ "../../../../classes/OrdersExcelExport");
        const OrdersExcelExport = d.OrdersExcelExport
        OrdersExcelExport.export(orders);
    }

    async markAs(orders: PrivateOrder[], status: OrderStatus) {
        try {
            const updatedOrders = await this.webshopManager.patchOrders(
                orders.map(o => PrivateOrder.patch({ status, id: o.id }))
            )

            // Move all data to original orders
            for (const order of updatedOrders) {
                const original = orders.find(o => o.id === order.id)
                if (original) {
                    original.set(order)
                }
            }

            if (status === OrderStatus.Deleted) {
                new Toast(orders.length == 1 ? "Bestelling verwijderd" : "Bestellingen verwijderd", "success").setHide(1500).show()
            } else {
                new Toast("Status gewijzigd", "success").setHide(1500).show()

                if (status == OrderStatus.Canceled) {
                    new Toast("Je moet zelf communiceren dat de bestelling werd geannuleerd", "warning yellow").setHide(10*1000).show()
                }
            }
            
        } catch (e) {
            Toast.fromError(e).show()
        }
    }
    
    async markPaid(orders: PrivateOrder[], paid = true) {
        const data: AutoEncoderPatchType<Payment>[] = []
        let willSendEmail = false

        for (const order of orders) {
            const payment = order.payment
            if (!payment) {
                continue
            }

            if (paid) {
                if (payment.status != PaymentStatus.Succeeded || order.data.totalPrice != payment.price) {
                    data.push(Payment.patch({
                        id: payment.id,
                        price: order.data.totalPrice,
                        status: PaymentStatus.Succeeded
                    }))

                    if (payment.method === PaymentMethod.Transfer && order.data.shouldSendPaymentUpdates) {
                        willSendEmail = true
                    }
                }
            } else {
                if (payment.status == PaymentStatus.Succeeded || order.data.totalPrice != payment.price) {
                    data.push(Payment.patch({
                        id: payment.id,
                        status: PaymentStatus.Created,
                        price: order.data.totalPrice
                    }))
                }
            }
            
        }
        
        if (data.length > 0) {
            if (willSendEmail && !await CenteredMessage.confirm("Ben je zeker?", paid ? "Markeer als betaald" : "Markeer als niet betaald", paid ? "De besteller ontvangt een automatische e-mail." : undefined)) {
                return;
            }
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>),
                    shouldRetry: false
                })

                // Update data of existing objects
                for (const order of orders) {
                    const payment = order.payment
                    if (!payment) {
                        continue
                    }
                    const p = response.data.find(pp => pp.id === payment.id)
                    if (p) {
                        payment.set(p)
                    }
                }
                new Toast("Betaalstatus gewijzigd", "success").setHide(1000).show()
            } catch (e) {
                Toast.fromError(e).show()
            }
        } else {
            new Toast(paid ? "Al gemarkeerd als betaald" : ("Deze "+ (orders.length == 1 ? "bestelling werd" : "bestellingen werden") +" nog niet betaald"), "error red").setHide(1000).show()
        }
    }

    async deleteOrders(orders: PrivateOrder[]) {
        if (!await CenteredMessage.confirm(orders.length == 1 ? "Bestelling "+orders[0].number+" ("+orders[0].data.customer.name+") verwijderen?" : "Bestellingen verwijderen?", "Verwijderen", "Je kan dit niet ongedaan maken.")) {
            return
        }

        try {
            await this.markAs(orders, OrderStatus.Deleted)
            for (const order of orders) {
                await this.webshopManager.deleteOrderFromDatabase(order.id)
            }
            await this.webshopManager.ordersEventBus.sendEvent("deleted", orders)
        } catch (e) {
            Toast.fromError(e).show()
            return;
        }
    }
}