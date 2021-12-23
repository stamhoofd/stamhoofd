import { Toast } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { CheckoutMethodType, OrderStatusHelper, PaymentMethod,PrivateOrder } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import XLSX from "xlsx";

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
        
        // Columns
        const wsData = [
            [
                "Bestelnummer",
                "Naam",
                "E-mail",
                "GSM-nummer",
                ...answerNames,
                "Aantal",
                "Product (terugloop aanzetten!)",
            ],
        ];

        for (const order of orders) {
            for (const [index, item] of order.data.cart.items.entries()) {
                const answers = answerNames.map(a => "")

                for (const a of order.data.fieldAnswers) {
                    const index = answerColumns.get(a.field.id)
                    if (index !== undefined) {
                        answers[index] = a.answer
                    }
                }

                const showDetails = index == 0 || repeat
                wsData.push([
                    showDetails ? `${order.number}` : "",
                    showDetails ? order.data.customer.name : "",
                    showDetails ? order.data.customer.email : "",
                    showDetails ? order.data.customer.phone : "",
                    ...answers,
                    `${item.amount}`,
                    `${item.product.name}${item.description ? "\r\n"+item.description : ""}`,
                ]);
            }
        }

        this.deleteEmptyColumns(wsData)

        const ws = XLSX.utils.aoa_to_sheet(wsData, { cellStyles: true });
        this.wrapColumn(5 + answerNames.length, ws)

        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (column.toLowerCase().startsWith("naam")) {
                ws['!cols'].push({width: 20});
            } else if (column.toLowerCase().includes("naam")) {
                ws['!cols'].push({width: 15});
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

        return ws
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
        
        // Columns
        const wsData: (string | number)[][] = [
            [
                "Bestelnummer",
                "Naam",
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

            const answers = answerNames.map(a => "")

            for (const a of order.data.fieldAnswers) {
                const index = answerColumns.get(a.field.id)
                if (index !== undefined) {
                    answers[index] = a.answer
                }
            }

            wsData.push([
                `${order.number}`,
                order.data.customer.name,
                order.data.customer.email,
                order.data.customer.phone,
                ...answers,
                checkoutType,
                address,
                order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : "/",
                order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime)+" - "+Formatter.minutes(order.data.timeSlot.endTime) : "/",
                order.data.deliveryPrice / 100,
                order.data.totalPrice / 100,
                order.data.paymentMethod == PaymentMethod.Transfer ? "Overschrijving" : order.data.paymentMethod,
                order.payment?.paidAt === null ? "Nog niet betaald" : "Betaald",
                OrderStatusHelper.getName(order.status),
                ...(shouldIncludeSettements ? 
                    (order.payment?.settlement ? [Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.payment.settlement.settledAt)), order.payment.settlement.reference] : ["/", "/"])
                    : []
                )
            ]);
        }

        // Delete after
        this.deleteEmptyColumns(wsData, shouldIncludeSettements ? 2 : 0)

        const ws = XLSX.utils.aoa_to_sheet(wsData, { cellStyles: true });
        const offset = shouldIncludeSettements ? 2 : 0
        this.formatColumn(wsData[0].length - 4 - offset, "€0.00", ws)
        this.formatColumn(wsData[0].length - 5 - offset, "€0.00", ws)

        if (shouldIncludeSettements) {
            this.formatColumn(wsData[0].length - 1, "€0.00", ws)
        }


        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (typeof column != "string") {
                continue
            }
            if (column.toLowerCase().startsWith("naam")) {
                ws['!cols'].push({width: 20});
            } else if (column.toLowerCase().includes("naam")) {
                ws['!cols'].push({width: 15});
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
                ws['!cols'].push({width: 13});
            }
        }

        return ws
    }

    /**
     * List all amount per product variant
     */
    static createSettlements(orders: PrivateOrder[]): XLSX.WorkSheet {
        
        // Columns
        const wsData: (string | number)[][] = [
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
                item.total / 100,
                item.amount / 100
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        this.formatColumn(wsData[0].length - 1, "€0.00", ws)
        this.formatColumn(wsData[0].length - 2, "€0.00", ws)

        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (typeof column != "string") {
                continue
            }
            if (column.toLowerCase().includes("totaal") || column.toLowerCase().includes("datum")) {
                ws['!cols'].push({width: 25});
            } else {
                ws['!cols'].push({width: 20});
            }
        }

        return ws
    }

    /**
     * List all amount per product variant
     */
    static createProducts(orders: PrivateOrder[]): XLSX.WorkSheet {
        
        // Columns
        const wsData: (string | number)[][] = [
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
                item.amount
            ]);
        }

        this.deleteEmptyColumns(wsData)

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (typeof column != "string") {
                continue
            }
            if (column.toLowerCase().startsWith("naam")) {
                ws['!cols'].push({width: 20});
            } else if (column.toLowerCase().includes("naam")) {
                ws['!cols'].push({width: 15});
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
            if(worksheet[ref].t != 'n') continue;
            /* assign the `.z` number format */
            worksheet[ref].z = fmt;
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

    static deleteEmptyColumns(wsData: (string | number)[][], skipLast = 0) {
        // Delete empty columns
        for (let index = wsData[0].length - 1 - skipLast; index >= 0; index--) {
            let empty = true
            for (const row of wsData.slice(1)) {
                const value = row[index]
                if (typeof value != "string") {
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
            if (order.payment?.method === PaymentMethod.Bancontact || order.payment?.method === PaymentMethod.iDEAL || order.payment?.method === PaymentMethod.CreditCard || order.payment?.settlement) {
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
