import { Toast } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { CartItem, CheckoutMethodType, OrderStatusHelper, PaymentMethod,PaymentMethodHelper,PaymentProvider,PrivateOrder, ProductType } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import XLSX from "xlsx";

import { ExcelHelper, RowValue } from './ExcelHelper';

function cartItemGroupingString(item: CartItem) {
    let name = item.product.name

    if (item.product.prices.length > 1) {
        name += " - " + item.productPrice.name
    }
    for (const option of item.options) {
        name += " - " + option.option.name
    }

    return name
}

export class OrdersExcelExport {

    /**
     * List of all products for every order
     */
    static createOrderLines(orders: PrivateOrder[]): XLSX.WorkSheet {
        /// Should we repeat all the duplicate fields for multiple lines in an order?
        const repeat = true

        const answerColumns = new Map<string, number>()
        const answerNames: string[] = []

        const optionColumns = new Map<string, number>()
        const optionNames: string[] = []

        for (const order of orders) {
            for (const a of order.data.fieldAnswers) {
                if (!answerColumns.has(a.field.id)) {
                    answerColumns.set(a.field.id, answerColumns.size)
                    answerNames.push(a.field.name)
                }
            }
        }

        // todo: First add record settings in order
        for (const order of orders) {
            for (const a of order.data.recordAnswers) {
                if (!answerColumns.has(a.settings.id)) {
                    answerColumns.set(a.settings.id, answerColumns.size)
                    answerNames.push(a.settings.name)
                }
            }


            // Add all prodcuct options and variants
            for (const item of order.data.cart.items) {
                
                // Produce prices
                if (item.product.prices.length > 1) {
                    const name = 'Prijskeuze'

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size)
                        optionNames.push(name)
                    }
                }

                // Ticket date/time
                if ((item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) && item.product.dateRange) {
                    const name = 'Ticketdatum'

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size)
                        optionNames.push(name)
                    }
                }

                // Produce options
                for (const menu of item.product.optionMenus) {
                    const name = menu.name

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size)
                        optionNames.push(name)
                    }
                }

                // Open questions
                for (const field of item.product.customFields) {
                    const name = field.name

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size)
                        optionNames.push(name)
                    }
                }
            }
        }

        
        // Columns
        const wsData: RowValue[][] = [
            [
                "Bestelnummer",
                "Besteldatum",
                "Voornaam",
                "Achternaam",
                "E-mail",
                "GSM-nummer",
                ...answerNames,
                "Notities",
                "Aantal",
                "Stukprijs",
                "Eenmalige extra kost",
                "Prijs",
                "Artikel",
                ...optionNames,

                // Duplicates
                "Afhaalmethode",
                "Leveringsadres / afhaallocatie",
                "Datum",
                "Tijdstip",
                "Betaalmethode",
                "Betaald",
                "Status",
            ],
        ];

        for (const order of orders) {
            let checkoutType = "/"
            let address = "/"
            if (order.data.checkoutMethod?.type == CheckoutMethodType.Takeout) {
                checkoutType = "Afhalen"
                address = order.data.checkoutMethod.name
            } else if (order.data.checkoutMethod?.type == CheckoutMethodType.Delivery) {
                checkoutType = "Levering" + (order.data.checkoutMethod.name.length > 0 ? "("+order.data.checkoutMethod.name+")" : "")
                address = order.data.address?.toString() ?? "??"
            }
            
            for (const [index, item] of order.data.cart.items.entries()) {
                const answers: RowValue[] = answerNames.map(a => "")
                const options: RowValue[] = optionNames.map(a => "")

                for (const a of order.data.fieldAnswers) {
                    const index = answerColumns.get(a.field.id)
                    if (index !== undefined) {
                        answers[index] = a.answer
                    }
                }

                for (const a of order.data.recordAnswers) {
                    const index = answerColumns.get(a.settings.id)
                    if (index !== undefined) {
                        answers[index] = a.excelValue
                    }
                }

                // Product price
                if (item.product.prices.length > 1) {
                    const columnName = 'Prijskeuze'
                    const index = optionColumns.get(Formatter.slug(columnName))
                    if (index !== undefined) {
                        options[index] = item.productPrice.name
                    }
                }

                if ((item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) && item.product.dateRange) {
                    const columnName = 'Ticketdatum'
                    const index = optionColumns.get(Formatter.slug(columnName))
                    if (index !== undefined) {
                        options[index] = item.product.dateRange.toString()
                    }
                }

                // Option menu's
                for (const option of item.options) {
                    const menu = option.optionMenu
                    const columnName = menu.name
                    const index = optionColumns.get(Formatter.slug(columnName))
                    if (index !== undefined) {
                        options[index] = option.option.name
                    }
                }

                // Open fields
                for (const answer of item.fieldAnswers) {
                    const field = answer.field
                    const columnName = field.name
                    const index = optionColumns.get(Formatter.slug(columnName))
                    if (index !== undefined) {
                        options[index] = answer.answer
                    }
                }

                const showDetails = index == 0 || repeat
                wsData.push([
                    showDetails ? {
                        value: order.number ?? 0,
                        format: '0'
                    } : "",
                    {
                        value: order.createdAt,
                        format: 'dd/mm/yyyy hh:mm'
                    },
                    showDetails ? order.data.customer.firstName : "",
                    showDetails ? order.data.customer.lastName : "",
                    showDetails ? order.data.customer.email : "",
                    showDetails ? order.data.customer.phone : "",
                    ...answers,
                    showDetails ? order.data.comments : "",
                    {
                        value: item.amount,
                        format: '0'
                    },
                    {
                        value: (item.getUnitPrice(order.data.cart) ?? 0) / 100,
                        format: '€0.00'
                    },
                    {
                        value: ((item.getPartialExtraPrice(order.data.cart) ?? 0)) / 100,
                        format: '€0.00'
                    },
                    {
                        value: (item.getPrice(order.data.cart) ?? 0) / 100,
                        format: '€0.00'
                    },
                    item.product.name,
                    ...options,
                    checkoutType,
                    address,
                    order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : "/",
                    order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime)+" - "+Formatter.minutes(order.data.timeSlot.endTime) : "/",
                    PaymentMethodHelper.getNameCapitalized(order.data.paymentMethod),
                    order.payment?.paidAt === null ? "Nog niet betaald" : "Betaald",
                    OrderStatusHelper.getName(order.status),
                    
                ]);
            }
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    /**
     * List all orders
     */
    static createOrders(orders: PrivateOrder[], shouldIncludeSettements: boolean): XLSX.WorkSheet {
        const answerColumns = new Map<string, number>()
        const answerNames: string[] = []

        for (const order of orders) {
            for (const a of order.data.fieldAnswers) {
                if (!answerColumns.has(a.field.id)) {
                    answerColumns.set(a.field.id, answerColumns.size)
                    answerNames.push(a.field.name)
                }
            }
        }

        // todo: First add record settings in order
        for (const order of orders) {
            for (const a of order.data.recordAnswers) {
                if (!answerColumns.has(a.settings.id)) {
                    answerColumns.set(a.settings.id, answerColumns.size)
                    answerNames.push(a.settings.name)
                }
            }
        }

        const itemColumns = new Map<string, number>()
        const itemNames: RowValue[] = []

        // Columns for products
        for (const order of orders) {
            for (const item of order.data.cart.items) {
                const group = cartItemGroupingString(item)
                if (!itemColumns.has(group)) {
                    itemColumns.set(group, itemColumns.size)
                    itemNames.push({
                        value: group,
                        width: group.length
                    })
                }
            }
        }
        
        // Columns
        const wsData: RowValue[][] = [
            [
                "Bestelnummer",
                "Besteldatum",
                "Voornaam",
                "Achternaam",
                "E-mail",
                "GSM-nummer",
                ...answerNames,
                "Notities",
                "Afhaalmethode",
                "Leveringsadres / afhaallocatie",
                "Datum",
                "Tijdstip",
                "Leveringskost",
                "Administratiekosten",
                "Totaal",
                "Betaalmethode",
                "Betaald",
                "Status",
                ...(shouldIncludeSettements ? ["Uitbetalingsdatum", "Uitbetalingsmededeling"] : []),
                ...itemNames
            ],
        ];

        for (const order of orders) {
            let checkoutType = "/"
            let address = "/"
            if (order.data.checkoutMethod?.type == CheckoutMethodType.Takeout) {
                checkoutType = "Afhalen"
                address = order.data.checkoutMethod.name
            } else if (order.data.checkoutMethod?.type == CheckoutMethodType.Delivery) {
                checkoutType = "Levering" + (order.data.checkoutMethod.name.length > 0 ? "("+order.data.checkoutMethod.name+")" : "")
                address = order.data.address?.toString() ?? "??"
            }

            const answers: RowValue[] = answerNames.map(a => "")

            for (const a of order.data.fieldAnswers) {
                const index = answerColumns.get(a.field.id)
                if (index !== undefined) {
                    answers[index] = a.answer
                }
            }

            for (const a of order.data.recordAnswers) {
                const index = answerColumns.get(a.settings.id)
                if (index !== undefined) {
                    answers[index] = a.excelValue
                }
            }

            const itemAmounts: RowValue[] = itemNames.map(a => "")

            for (const item of order.data.cart.items) {
                const group = cartItemGroupingString(item)
                const index = itemColumns.get(group)
                if (index !== undefined) {
                    itemAmounts[index] = item.amount
                }
            }

            wsData.push([
                {
                    value: order.number ?? 0,
                    format: '0'
                },
                {
                    value: order.createdAt,
                    format: 'dd/mm/yyyy hh:mm'
                },
                order.data.customer.firstName,
                order.data.customer.lastName,
                order.data.customer.email,
                order.data.customer.phone,
                ...answers,
                order.data.comments,
                checkoutType,
                address,
                order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : "/",
                order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime)+" - "+Formatter.minutes(order.data.timeSlot.endTime) : "/",
                {
                    value: order.data.deliveryPrice / 100,
                    format: "€0.00"
                },
                {
                    value: order.data.administrationFee / 100,
                    format: "€0.00"
                },
                {
                    value: order.data.totalPrice / 100,
                    format: "€0.00"
                },
                PaymentMethodHelper.getNameCapitalized(order.data.paymentMethod),
                order.pricePaid < order.totalToPay ? "Nog niet betaald" : "Betaald",
                OrderStatusHelper.getName(order.status),
                ...(shouldIncludeSettements ? 
                    (order.payment?.settlement ? [Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.payment.settlement.settledAt)), order.payment.settlement.reference] : ["/", "/"])
                    : []
                ),
                ...itemAmounts
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    /**
     * List all amount per product variant
     */
    static createSettlements(orders: PrivateOrder[]): XLSX.WorkSheet {
        
        // Columns
        const wsData: RowValue[][] = [
            [
                "ID",
                "Mededeling",
                "Datum",
                "Totaal uitbetaald",
                "Totaal van deze bestellingen",
                "Transactiekosten (incl. BTW)"
            ],
        ];

        const counter: Map<string, { id: string, reference: string, settledAt: Date, amount: number; total: number; fees: number}> = new Map()

        for (const order of orders) {
            if (order.payment?.settlement) {
                const settlement = order.payment.settlement
                
                const existing = counter.get(settlement.id)
                if (existing) {
                    existing.settledAt = settlement.settledAt
                    existing.total = settlement.amount
                    existing.amount += order.payment.price
                    existing.fees += settlement.fee
                } else {
                    counter.set(settlement.id, {
                        id: settlement.id,
                        reference: settlement.reference,
                        settledAt: settlement.settledAt,
                        amount: order.payment.price,
                        total: settlement.amount,
                        fees: settlement.fee
                    })
                }
            }
        }

        // Sort by date
        const arr = Array.from(counter.values())
        arr.sort((a, b) => Sorter.byDateValue(a.settledAt, b.settledAt))

        for (const item of arr) {
          
            wsData.push([
                item.id,
                item.reference,
                Formatter.capitalizeFirstLetter(Formatter.dateWithDay(item.settledAt)),
                {
                    value: item.total / 100,
                    format: "€0.00"
                },
                {
                    value: item.amount / 100,
                    format: "€0.00"
                },
                {
                    value: item.fees / 100,
                    format: "€0.00"
                }
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 20
        })
    }

    /**
     * List all amount per product variant
     */
    static createProducts(orders: PrivateOrder[]): XLSX.WorkSheet {
        
        // Columns
        const wsData: RowValue[][] = [
            [
                "Artikel",
                "Variant",
                "Aantal"
            ],
        ];

        const counter: Map<string, { amount: number; name: string; variant: string}> = new Map()

        for (const order of orders) {
            for (const item of order.data.cart.items) {
                const code = item.codeWithoutFields
                let existing = counter.get(code)
                if (!existing) {
                    existing = { amount: 0, name: item.product.name,  variant: item.descriptionWithoutFields}
                    counter.set(code, existing)
                }
                existing.amount += item.amount
            }
        }

        // Sort by amount
        const arr = Array.from(counter.values())
        arr.sort((a, b) => Sorter.stack(Sorter.byStringProperty(a, b, "name"), Sorter.byNumberProperty(a, b, "amount")))

        for (const item of arr) {
          
            wsData.push([
                item.name,
                item.variant,
                {
                    value: item.amount,
                    format: "0"
                }
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    static export(orders: PrivateOrder[]) {
        const wb = XLSX.utils.book_new();

        let shouldIncludeSettements = false

        for (const order of orders) {
            if (((order.payment?.method === PaymentMethod.Bancontact || order.payment?.method === PaymentMethod.iDEAL || order.payment?.method === PaymentMethod.CreditCard) && (order.payment?.provider === PaymentProvider.Mollie || order.payment?.provider === PaymentProvider.Stripe)) || order.payment?.settlement) {
                shouldIncludeSettements = true
            }
        }
        
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createOrderLines(orders), "Artikel per lijn");
        XLSX.utils.book_append_sheet(wb, this.createOrders(orders, shouldIncludeSettements), "Bestelling per lijn");
        XLSX.utils.book_append_sheet(wb, this.createProducts(orders), "Totalen");

        if (shouldIncludeSettements) {
            XLSX.utils.book_append_sheet(wb, this.createSettlements(orders), "Uitbetalingen");
        }

        if (AppManager.shared.downloadFile) {
            const data = XLSX.write(wb, { type: 'base64' });
            AppManager.shared.downloadFile(data, "bestellingen.xlsx").catch(e => {
                Toast.fromError(e).show()
            });
        } else {
            XLSX.writeFile(wb, "bestellingen.xlsx");
        }
    }
}
