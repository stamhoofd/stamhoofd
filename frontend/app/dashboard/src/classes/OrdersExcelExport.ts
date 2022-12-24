import { Toast } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { CheckoutMethodType, OrderStatusHelper, PaymentMethod,PaymentMethodHelper,PaymentProvider,PrivateOrder } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import XLSX from "xlsx";

type RowValue = (string | number | Date | {value: string | number | Date, format: null | string});

function transformRowValues(row: RowValue[][]): (string | number | Date)[][] {
    return row.map(r => r.map(c => {
        if (typeof c === "object" && !(c instanceof Date)) {
            return c.value
        }
        return c
    }))
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
        
        // Columns
        const wsData: RowValue[][] = [
            [
                "Bestelnummer",
                "Voornaam",
                "Achternaam",
                "E-mail",
                "GSM-nummer",
                ...answerNames,
                "Aantal",
                "Stukprijs",
                "Prijs",
                "Product (terugloop aanzetten!)",
            ],
        ];

        for (const order of orders) {
            for (const [index, item] of order.data.cart.items.entries()) {
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

                const showDetails = index == 0 || repeat
                wsData.push([
                    showDetails ? {
                        value: order.number ?? 0,
                        format: '0'
                    } : "",
                    showDetails ? order.data.customer.firstName : "",
                    showDetails ? order.data.customer.lastName : "",
                    showDetails ? order.data.customer.email : "",
                    showDetails ? order.data.customer.phone : "",
                    ...answers,
                    {
                        value: item.amount,
                        format: '0'
                    },
                    {
                        value: (item.getUnitPrice(order.data.cart) ?? 0) / 100,
                        format: '€0.00'
                    },
                    {
                        value: (item.getPrice(order.data.cart) ?? 0) / 100,
                        format: '€0.00'
                    },
                    `${item.product.name}${item.description ? "\r\n"+item.description : ""}`,
                ]);
            }
        }

        return this.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })

        /*this.deleteEmptyColumns(wsData)

        const ws = XLSX.utils.aoa_to_sheet(wsData, { cellStyles: true });
        this.wrapColumn(5 + answerNames.length, ws)

        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (column.toLowerCase().startsWith("naam")) {
                ws['!cols'].push({width: 20});
            } else if (column.toLowerCase().includes("naam")) {
                ws['!cols'].push({width: 13});
            } else if (column.toLowerCase().includes("e-mail")) {
                ws['!cols'].push({width: 25});
            } else if (column.toLowerCase().includes("adres")) {
                ws['!cols'].push({width: 30});
            } else if (column.toLowerCase().includes("gsm")) {
                ws['!cols'].push({width: 16});
            } else if (column.toLowerCase().includes("product")) {
                ws['!cols'].push({width: 40});
            } else {
                ws['!cols'].push({width: 13});
            }
        }

        return ws*/
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
                "Afhaalmethode",
                "Leveringsadres / afhaallocatie",
                "Datum",
                "Tijdstip",
                "Leveringskost",
                "Totaal",
                "Betaalmethode",
                "Betaald",
                "Status",
                ...(shouldIncludeSettements ? ["Mollie uitbetalingsdatum", "Uitbetalingsmededeling"] : [])
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
                checkoutType,
                address,
                order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : "/",
                order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime)+" - "+Formatter.minutes(order.data.timeSlot.endTime) : "/",
                {
                    value: order.data.deliveryPrice / 100,
                    format: "€0.00"
                },
                {
                    value: order.data.totalPrice / 100,
                    format: "€0.00"
                },
                PaymentMethodHelper.getNameCapitalized(order.data.paymentMethod),
                order.payment?.paidAt === null ? "Nog niet betaald" : "Betaald",
                OrderStatusHelper.getName(order.status),
                ...(shouldIncludeSettements ? 
                    (order.payment?.settlement ? [Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.payment.settlement.settledAt)), order.payment.settlement.reference] : ["/", "/"])
                    : []
                )
            ]);
        }

        return this.buildWorksheet(wsData, {
            keepLastColumns: shouldIncludeSettements ? 2 : 0,
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
                "Mededeling",
                "Datum",
                "Totaal uitbetaald",
                "Totaal van deze bestellingen"
            ],
        ];

        const counter: Map<string, { reference: string, settledAt: Date, amount: number; total: number}> = new Map()

        for (const order of orders) {
            if (order.payment?.settlement) {
                const settlement = order.payment.settlement
                
                const existing = counter.get(settlement.reference)
                if (existing) {
                    existing.settledAt = settlement.settledAt
                    existing.total = settlement.amount
                    existing.amount += order.payment.price
                } else {
                    counter.set(settlement.reference, {
                        reference: settlement.reference,
                        settledAt: settlement.settledAt,
                        amount: order.payment.price,
                        total: settlement.amount
                    })
                }
            }
        }

        // Sort by date
        const arr = Array.from(counter.values())
        arr.sort((a, b) => Sorter.byDateValue(a.settledAt, b.settledAt))

        for (const item of arr) {
          
            wsData.push([
                item.reference,
                Formatter.capitalizeFirstLetter(Formatter.dateWithDay(item.settledAt)),
                {
                    value: item.total / 100,
                    format: "€0.00"
                },
                {
                    value: item.amount / 100,
                    format: "€0.00"
                }
            ]);
        }

        return this.buildWorksheet(wsData, {
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
                "Product",
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

        return this.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    static buildWorksheet(wsData: RowValue[][], options: {keepLastColumns?: number, defaultColumnWidth?: number}) {
        // Delete after
        this.deleteEmptyColumns(wsData, options?.keepLastColumns)

        const ws = XLSX.utils.aoa_to_sheet(transformRowValues(wsData), { cellStyles: true, cellDates: true });

        // Format columns based on format option in wsData
        if (wsData[1]) {
            for (const [index, col] of wsData[1].entries()) {
                if (typeof col !== "object" || (col instanceof Date)) {
                    continue
                }
                if (col.format) {
                    this.formatColumn(index, col.format, ws)
                }
            }
        }

        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (typeof column != "string") {
                continue
            }
            if (column.toLowerCase().includes("totaal") || column.toLowerCase().includes("datum")) {
                ws['!cols'].push({width: 25});
            } else if (column.toLowerCase().startsWith("naam")) {
                ws['!cols'].push({width: 20});
            } else if (column.toLowerCase().includes("naam")) {
                ws['!cols'].push({width: 13});
            } else if (column.toLowerCase().includes("e-mail")) {
                ws['!cols'].push({width: 25});
            } else if (column.toLowerCase().includes("adres")) {
                ws['!cols'].push({width: 30});
            } else if (column.toLowerCase().includes("gsm")) {
                ws['!cols'].push({width: 16});
            } else if (column.toLowerCase().includes("product")) {
                ws['!cols'].push({width: 40});
            } else if (column.toLowerCase().includes("uitbetaling")) {
                ws['!cols'].push({width: 25});
            } else {
                ws['!cols'].push({width: options?.defaultColumnWidth ?? 13});
            }
        }

        return ws
    }

    static formatColumn(colNum: number, fmt: string, worksheet: any) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for(let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({r:i, c:colNum});
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if(!worksheet[ref]) continue;
            /* `.t == "n"` for number cells */
            if(worksheet[ref].t != 'n' && worksheet[ref].t != 'd') continue;
            /* assign the `.z` number format */
            worksheet[ref].z = fmt;
            delete worksheet[ref].w;
        }
    }

    static wrapColumn(colNum: number, worksheet: any) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for(let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({r:i, c:colNum});
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if(!worksheet[ref]) continue;
            worksheet[ref].s = { alignment: { wrapText: true } }
        }
    }

    static deleteEmptyColumns(wsData: RowValue[][], skipLast = 0) {
        // Delete empty columns
        for (let index = wsData[0].length - 1 - skipLast; index >= 0; index--) {
            let empty = true
            for (const row of wsData.slice(1)) {
                let value = row[index]

                if (typeof value === 'object' && !(value instanceof Date)) {
                    if (value == null) {
                        continue;
                    }
                    value = value.value
                }

                if (value instanceof Date) {
                    empty = false
                    break
                }

                if (typeof value !== "string") {
                    
                    if (value == 0) {
                        // If all zero: empty
                        continue;
                    }
                    empty = false
                    break
                }
                if (value.length == 0 || value == "/") {
                    continue;
                }
                empty = false
                break
            }
            if (empty) {
                for (const row of wsData) {
                    row.splice(index, 1)
                } 
            }
        }
    }

    static export(orders: PrivateOrder[]) {
        const wb = XLSX.utils.book_new();

        let shouldIncludeSettements = false

        for (const order of orders) {
            if (((order.payment?.method === PaymentMethod.Bancontact || order.payment?.method === PaymentMethod.iDEAL || order.payment?.method === PaymentMethod.CreditCard) && (order.payment?.provider === PaymentProvider.Mollie)) || order.payment?.settlement) {
                shouldIncludeSettements = true
            }
        }
        
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createOrderLines(orders), "Bestellingen + producten");
        XLSX.utils.book_append_sheet(wb, this.createOrders(orders, shouldIncludeSettements), "Bestellingen");
        XLSX.utils.book_append_sheet(wb, this.createProducts(orders), "Producten");

        if (shouldIncludeSettements) {
            XLSX.utils.book_append_sheet(wb, this.createSettlements(orders), "Mollie uitbetalingen");
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
