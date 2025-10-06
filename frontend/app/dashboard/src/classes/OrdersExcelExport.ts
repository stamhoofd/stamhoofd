import { Toast } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { CartItem, CartItemOption, CheckoutMethodType, OrderStatusHelper, PaymentMethodHelper, PrivateOrder, ProductType, ReservedSeat, Webshop } from '@stamhoofd/structures';
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
    static createOrderLines(webshop: Webshop, orders: PrivateOrder[]): XLSX.WorkSheet {
        /// Should we repeat all the duplicate fields for multiple lines in an order?
        const repeat = true

        const answerColumns = new Map<string, number>()
        const answerNames: string[] = []

        const optionColumns = new Map<string, number>()
        const optionNames: string[] = []

        for (const order of orders) {
            for (const a of order.data.fieldAnswers) {
                if (!answerColumns.has(a.field.id)) {
                    answerColumns.set(a.field.id, answerNames.length)
                    answerNames.push(a.field.name)
                }
            }
        }

        // First add record settings in order
        for (const recordSettings of webshop.meta.recordCategories.flatMap(r => r.getAllRecords())) {
            if (!answerColumns.has(recordSettings.id)) {
                answerColumns.set(recordSettings.id, answerNames.length);
                const columns = recordSettings.excelColumns;
                for (const c of columns) {
                    answerNames.push(c);
                }
            }
        }

        for (const product of webshop.productsInOrder) {
            // Produce prices
            if (product.prices.length > 1) {
                const name = 'Prijskeuze'

                if (!optionColumns.has(Formatter.slug(name))) {
                    optionColumns.set(Formatter.slug(name), optionColumns.size);
                    optionNames.push(name);
                }
            }

            // Ticket date/time
            if ((product.type === ProductType.Ticket || product.type === ProductType.Voucher) && product.dateRange) {
                const name = 'Ticketdatum'

                if (!optionColumns.has(Formatter.slug(name))) {
                    optionColumns.set(Formatter.slug(name), optionColumns.size);
                    optionNames.push(name);
                }
            }

            // Produce options
            for (const menu of product.optionMenus) {
                const name = menu.name;

                if (!optionColumns.has(Formatter.slug(name))) {
                    optionColumns.set(Formatter.slug(name), optionColumns.size);
                    optionNames.push(name);
                }
            }

            // Open questions
            for (const field of product.customFields) {
                const name = field.name;

                if (!optionColumns.has(Formatter.slug(name))) {
                    optionColumns.set(Formatter.slug(name), optionColumns.size);
                    optionNames.push(name);
                }
            }
        }

        // If there are still any deleted records or option menu's, that are no longer in the shop, also add them
        for (const order of orders) {
            for (const a of order.data.recordAnswers) {
                if (!answerColumns.has(a.settings.id)) {
                    answerColumns.set(a.settings.id, answerNames.length)
                    const columns = a.excelColumns
                    for (const c of columns) {
                        answerNames.push(c)
                    }
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
                "Korting",
                "Prijs",
                "Artikel",
                ...optionNames,
                "Plaatsen",

                // Duplicates
                "Afhaalmethode",
                "Leveringsadres / afhaallocatie",
                "Datum",
                "Tijdstip",
                "Betaalmethode",
                "Betaald",
                "Status",
                "Kortingscode"
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
                        const values = a.excelValues
                        for (const [i, v] of values.entries()) {
                            answers[index + i] = v
                        }
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
                        if (options[index]) {
                            const value = options[index]

                            if (typeof value === 'object' && !(value instanceof Date)) {
                                value.value = value.value + ", " + option.option.name
                            } else {
                                if (typeof value === 'string') {
                                    options[index] = value + ", " + option.option.name
                                } else {
                                    // invalid!
                                }
                            }
                        } else {
                            options[index] = option.option.name
                        }
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
                        value: ((item.getPriceWithDiscounts() - item.getPriceWithoutDiscounts())) / 100,
                        format: '€0.00'
                    },
                    {
                        value: (item.getPriceWithDiscounts() ?? 0) / 100,
                        format: '€0.00'
                    },
                    item.product.name,
                    ...options,
                    item.seats.slice().sort(ReservedSeat.sort).map(s => s.getNameString(webshop, item.product)).join(", "),
                    checkoutType,
                    address,
                    order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : "/",
                    order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime)+" - "+Formatter.minutes(order.data.timeSlot.endTime) : "/",
                    PaymentMethodHelper.getNameCapitalized(order.data.paymentMethod),
                    order.payment?.paidAt === null ? "Nog niet betaald" : "Betaald",
                    OrderStatusHelper.getName(order.status),
                    order.data.discountCodes.map(d => d.code).join(", ")
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
    static createOrders(webshop: Webshop, orders: PrivateOrder[]): XLSX.WorkSheet {
        const answerColumns = new Map<string, number>();
        const answerNames: string[] = [];

        for (const order of orders) {
            for (const a of order.data.fieldAnswers) {
                if (!answerColumns.has(a.field.id)) {
                    answerColumns.set(a.field.id, answerNames.length)
                    answerNames.push(a.field.name)
                }
            }
        }

        // First add record settings in order
        for (const recordSettings of webshop.meta.recordCategories.flatMap(r => r.getAllRecords())) {
            if (!answerColumns.has(recordSettings.id)) {
                answerColumns.set(recordSettings.id, answerNames.length);
                const columns = recordSettings.excelColumns;
                for (const c of columns) {
                    answerNames.push(c);
                }
            }
        }

        for (const order of orders) {
            for (const a of order.data.recordAnswers) {
                if (!answerColumns.has(a.settings.id)) {
                    answerColumns.set(a.settings.id, answerNames.length)
                    const columns = a.excelColumns
                    for (const c of columns) {
                        answerNames.push(c)
                    }
                }
            }
        }

        const itemColumns = new Map<string, number>()
        const itemNames: (RowValue & {value: string})[] = []

        // First add all products that have maximum 1 option menu and product prices
        for (const product of webshop.productsInOrder) {
            if (product.optionMenus.length > 1) {
                continue;
            }

            if (product.optionMenus[0] && product.optionMenus[0].multipleChoice) {
                continue;
            }

            for (const productPrice of product.prices) {
                for (const option of product.optionMenus[0]?.options ?? [null]) {
                    const group = cartItemGroupingString(CartItem.create({
                        product,
                        productPrice,
                        options: option ? [CartItemOption.create({
                            option,
                            optionMenu: product.optionMenus[0]
                        })] : []
                    }))
                    const groupName = Formatter.slug(group)

                    if (!itemColumns.has(groupName)) {
                        itemColumns.set(groupName, itemColumns.size)
                        itemNames.push({
                            value: group,
                            width: group.length
                        })
                    }
                }
            }
        }

        // Columns for products
        for (const order of orders) {
            for (const item of order.data.cart.items) {
                const group = cartItemGroupingString(item)
                const groupName = Formatter.slug(group)
                if (!itemColumns.has(groupName)) {
                    itemColumns.set(groupName, itemColumns.size)
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
                "Subtotaal",
                "Korting",
                "Leveringskost",
                "Administratiekosten",
                "Totaal",
                "Betaalmethode",
                "Betaald",
                "Status",
                "Kortingscode",
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
                    const values = a.excelValues
                    for (const [i, v] of values.entries()) {
                        answers[index + i] = v
                    }
                }
            }

            const itemAmounts: number[] = itemNames.map(a => 0)

            for (const item of order.data.cart.items) {
                const group = cartItemGroupingString(item);
                const groupName = Formatter.slug(group);
                const index = itemColumns.get(groupName);
                if (index !== undefined) {
                    itemAmounts[index] = (itemAmounts[index] ?? 0) + item.amount
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
                    value: order.data.cart.priceWithDiscounts / 100,
                    format: "€0.00"
                },
                {
                    value: (order.data.appliedPercentageDiscount + order.data.fixedDiscount) / 100,
                    format: "€0.00"
                },
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
                order.data.discountCodes.map(d => d.code).join(", "),
                ...itemAmounts
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13,
            keepLastColumns: itemNames.length
        })
    }

    /**
     * List all amount per product variant
     */
    static createProducts(webshop: Webshop, orders: PrivateOrder[]): XLSX.WorkSheet | null {
        // Columns
        const wsData: RowValue[][] = [
            [
                "Artikel",
                "Variant",
                "Aantal"
            ],
        ];

        const counter: Map<string, { amount: number; name: string; variant: string, grouping: string}> = new Map()

        for (const order of orders) {
            for (const item of order.data.cart.items) {
                const code = item.codeWithoutFields
                let existing = counter.get(code)
                if (!existing) {
                    existing = { amount: 0, name: item.product.name,  variant: item.descriptionWithoutFields, grouping: cartItemGroupingString(item) }
                    counter.set(code, existing)
                }
                existing.amount += item.amount
            }
        }

        // Sort by amount
        const arr = Array.from(counter.values())
        arr.sort((a, b) => Sorter.stack(Sorter.byStringProperty(a, b, "name"), Sorter.byNumberProperty(a, b, "amount")))
        let hasVariant = false;

        for (const item of arr) {
            hasVariant = hasVariant || item.grouping !== item.name
          
            wsData.push([
                item.name,
                item.variant,
                {
                    value: item.amount,
                    format: "0"
                }
            ]);
        }

        // If all variant rows are empty: return null
        if (!hasVariant) {
            return null;
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    /**
     * List all amount per option menu (unique names)
     */
    static createOptions(webshop: Webshop, orders: PrivateOrder[]): XLSX.WorkSheet {
        const productPriceColumns = new Map<string, { name: string }>();
        const optionColumns = new Map<string, { name: string }>();
        type ProductData = { amount: number; name: string; date: string; optionCounts: Map<string, number>; productPriceCounts: Map<string, number> };
        const counter: Map<string, ProductData> = new Map();

        // First insert the products in order
        for (const product of webshop.productsInOrder) {
            let date = '';
            if ((product.type === ProductType.Ticket || product.type === ProductType.Voucher) && product.dateRange) {
                date = Formatter.capitalizeFirstLetter(product.dateRange.toString());
            }
            const code = Formatter.slug(product.name + date);
            const productData = counter.get(code) ?? { amount: 0, name: product.name, date, optionCounts: new Map(), productPriceCounts: new Map() };
            counter.set(code, productData);

            for (const price of product.prices) {
                const name = price.name || 'Standaardtarief';
                const slug = Formatter.slug(name);
                productData.productPriceCounts.set(name, 0);

                if (!productPriceColumns.has(slug)) {
                    productPriceColumns.set(slug, {
                        name,
                    });
                }
            }

            for (const optionMenu of product.optionMenus) {
                for (const option of optionMenu.options) {
                    const name = option.name;
                    const slug = Formatter.slug(name);
                    productData.optionCounts.set(slug, 0);

                    if (!optionColumns.has(slug)) {
                        optionColumns.set(slug, {
                            name,
                        });
                    }
                }
            }
        }

        // Add missing products in webshop (in case of deleted products)
        for (const order of orders) {
            // Add all prodcuct options and variants
            for (const item of order.data.cart.items) {
                // Produce prices
                if (item.productPrice.name) {
                    const name = item.productPrice.name || 'Standaardtarief'

                    if (!productPriceColumns.has(Formatter.slug(name))) {
                        productPriceColumns.set(Formatter.slug(name), {
                            name
                        })
                    }
                }

                for (const option of item.options) {
                    const name = option.option.name

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), {
                            name
                        })
                    }
                }
            }
        }

        const productPriceColumnsArr = Array.from(productPriceColumns.keys());
        const optionColumnsArr = Array.from(optionColumns.keys());

        // Columns
        const wsData: RowValue[][] = [
            [
                "Artikel",
                "Datum",
                "Totaal",
                ...productPriceColumnsArr.map(a => productPriceColumns.get(a)!.name),
                ...optionColumnsArr.map(a => optionColumns.get(a)!.name)
            ],
        ];

        for (const order of orders) {
            for (const item of order.data.cart.items) {

                let date = '';
                if ((item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) && item.product.dateRange) {
                    date = Formatter.capitalizeFirstLetter(item.product.dateRange.toString())
                }
                const code = Formatter.slug(item.product.name + date)

                const productData = counter.get(code) ?? { amount: 0, name: item.product.name, date, optionCounts: new Map(), productPriceCounts: new Map() }
                counter.set(code, productData)
                
                productData.amount += item.amount
                
                if (item.productPrice.name) {
                    const name = Formatter.slug(item.productPrice.name || 'Standaardtarief')
                    productData.productPriceCounts.set(name, (productData.productPriceCounts.get(name) ?? 0) + item.amount)
                }

                for (const option of item.options) {
                    const name = Formatter.slug(option.option.name)
                    productData.optionCounts.set(name, (productData.optionCounts.get(name) ?? 0) + item.amount)
                }
                
            }
        }

        const arr = Array.from(counter.values());

        for (const item of arr) {
            wsData.push([
                item.name,
                item.date,
                {
                    value: item.amount,
                    format: "0"
                },
                ...productPriceColumnsArr.map(a => {
                    const value = item.productPriceCounts.get(a)
                    return {
                        value: value ?? 0,
                        format: "0"
                    }
                }),
                ...optionColumnsArr.map(a => {
                    const value = item.optionCounts.get(a)
                    return {
                        value: value ?? 0,
                        format: "0"
                    }
                })
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    static export(webshop: Webshop, orders: PrivateOrder[]) {
        const wb = XLSX.utils.book_new();
        
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createOrderLines(webshop, orders), "Artikel per lijn");
        XLSX.utils.book_append_sheet(wb, this.createOrders(webshop, orders), "Bestelling per lijn");
        const products = this.createProducts(webshop, orders);

        if (products) {
            XLSX.utils.book_append_sheet(wb, products, "Totalen per combinatie");
        }
        XLSX.utils.book_append_sheet(wb, this.createOptions(webshop, orders), "Totalen");


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
