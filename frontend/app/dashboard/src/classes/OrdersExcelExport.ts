import { CheckoutMethodType, Order, PaymentMethod } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import XLSX from "xlsx";

export class OrdersExcelExport {

    /**
     * List of all products for every order
     */
    static createOrderLines(orders: Order[]): XLSX.WorkSheet {
        /// Should we repeat all the duplicate fields for multiple lines in an order?
        const repeat = false
        
        // Columns
        const wsData = [
            [
                "Bestelnummer",
                "Naam",
                "E-mail",
                "GSM-nummer",
                "Aantal",
                "Product (terugloop aanzetten!)",
            ],
        ];

        for (const order of orders) {
            for (const [index, item] of order.data.cart.items.entries()) {
                const showDetails = index == 0 || repeat
                wsData.push([
                    showDetails ? `${order.number}` : "",
                    showDetails ? order.data.customer.name : "",
                    showDetails ? order.data.customer.email : "",
                    showDetails ? order.data.customer.phone : "",
                    `${item.amount}`,
                    `${item.product.name}${item.description ? "\r\n"+item.description : ""}`,
                ]);
            }
        }

        this.deleteEmptyColumns(wsData)

        const ws = XLSX.utils.aoa_to_sheet(wsData);

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
    static createOrders(orders: Order[]): XLSX.WorkSheet {
        /// Should we repeat all the duplicate fields for multiple lines in an order?
        const repeat = false
        
        // Columns
        const wsData: (string | number)[][] = [
            [
                "Bestelnummer",
                "Naam",
                "E-mail",
                "GSM-nummer",
                "Afhaalmethode",
                "Leveringsadres / afhaallocatie",
                "Datum",
                "Tijdstip",
                "Leveringskost",
                "Totaal",
                "Betaalmethode",
                "Betaald"
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

            wsData.push([
                `${order.number}`,
                order.data.customer.name,
                order.data.customer.email,
                order.data.customer.phone,
                checkoutType,
                address,
                order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : "/",
                order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime)+" - "+Formatter.minutes(order.data.timeSlot.endTime) : "/",
                order.data.deliveryPrice / 100,
                order.data.totalPrice / 100,
                order.data.paymentMethod == PaymentMethod.Transfer ? "Overschrijving" : order.data.paymentMethod,
                order.payment?.paidAt === null ? "Nog niet betaald" : "Betaald"
            ]);
        }

        this.deleteEmptyColumns(wsData)

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        this.formatColumn(wsData[0].length - 3, "€0.00", ws)
        this.formatColumn(wsData[0].length - 4, "€0.00", ws)

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

    /**
     * List all amount per product variant
     */
    static createProducts(orders: Order[]): XLSX.WorkSheet {
        
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
                const id = item.id
                let existing = counter.get(id)
                if (!existing) {
                    existing = { amount: 0, name: item.product.name,  variant: item.description}
                    counter.set(id, existing)
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

    static deleteEmptyColumns(wsData: (string | number)[][]) {
        // Delete empty columns
        for (let index = wsData[0].length - 1; index >= 0; index--) {
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

    static export(orders: Order[]) {
        const wb = XLSX.utils.book_new();
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createOrderLines(orders), "Bestellingen + producten");
        XLSX.utils.book_append_sheet(wb, this.createOrders(orders), "Bestellingen");
        XLSX.utils.book_append_sheet(wb, this.createProducts(orders), "Producten");

        // todo: also add other sheets
        XLSX.writeFile(wb, "bestellingen.xlsx");
    }
}
