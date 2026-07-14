import type { CellValue, XlsxTransformerColumn, XlsxTransformerConcreteColumn, XlsxTransformerSheet } from '@stamhoofd/excel-writer/core';
import type { Organization, PrivateOrder, PrivateOrderWithTickets, Product, TicketPublicPrivate, Webshop } from '@stamhoofd/structures';
import { CartItem, CartItemOption, CheckoutMethodType, Gender, getGenderName, OrderStatusHelper, PaymentMethodHelper, ProductType, RecordCategory, ReservedSeat, TicketPublic } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

/**
 * A column as shown in the export settings (ExcelExportView). One selectable column can
 * expand to multiple concrete Excel columns (e.g. address records).
 */
export type OrdersExcelColumnGroup<R> = {
    id: string;
    name: string;
    description?: string;
    /**
     * Groups the column in the export settings, and is written as a category row above the
     * headers in the Excel file (unless the category row is turned off).
     */
    category?: string;
    /**
     * Default enabled state in the UI (defaults to true)
     */
    enabled?: boolean;
    columns: XlsxTransformerConcreteColumn<R>[];
};

export type OrdersExcelSheet<R> = {
    id: string;
    name: string;
    description?: string;
    transform: (orders: PrivateOrderWithTickets[]) => R[];
    groups: OrdersExcelColumnGroup<R>[];
};

type OrderLineRow = {
    order: PrivateOrder;
    item: CartItem;
};

/**
 * The categories used to group the columns. Getters, because the translations can only be
 * read at runtime. The categories of the answers are the record categories of the webshop itself.
 */
const columnCategories = {
    get order() {
        return $t(`Bestelling`);
    },
    get customer() {
        return $t(`Klant`);
    },
    get questions() {
        return $t(`Vragen`);
    },
    get item() {
        return $t(`Artikel`);
    },
    get checkout() {
        return $t(`Afhalen of leveren`);
    },
    get price() {
        return $t(`Prijs`);
    },
    get payment() {
        return $t(`Betaling en status`);
    },
    get orderedItems() {
        return $t(`Bestelde artikels`);
    },
    get ticket() {
        return $t(`Ticket`);
    },
    get scanning() {
        return $t(`Scannen`);
    },
    get qrCode() {
        return $t(`QR-code`);
    },
    get priceChoices() {
        return $t(`Prijskeuzes`);
    },
    get options() {
        return $t(`Opties`);
    },
};

function currencyStyle() {
    return {
        numberFormat: {
            formatCode: '€0.00',
        },
    };
}

function integerStyle() {
    return {
        numberFormat: {
            formatCode: '0',
        },
    };
}

function cartItemGroupingString(item: CartItem) {
    let name = item.product.name;

    if (item.product.prices.length > 1) {
        name += ' - ' + item.productPrice.name;
    }
    for (const option of item.options) {
        name += ' - ' + option.option.name;
    }

    return name;
}

/**
 * Helper for a selectable column that maps to exactly one Excel column.
 */
function singleColumnGroup<R>(data: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    enabled?: boolean;
    width?: number;
    getValue: (row: R) => CellValue;
}): OrdersExcelColumnGroup<R> {
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        enabled: data.enabled,
        columns: [{
            id: data.id,
            name: data.name,
            width: data.width ?? 0, // 0 = automatic width based on the column name
            getValue: data.getValue,
        }],
    };
}

/**
 * Columns are grouped per category, in the order the categories first occur. The Excel category row
 * merges consecutive columns of the same category, so the columns of one category have to stay together.
 */
function groupColumnsByCategory<R>(groups: OrdersExcelColumnGroup<R>[]): OrdersExcelColumnGroup<R>[] {
    const byCategory = new Map<string, OrdersExcelColumnGroup<R>[]>();

    for (const group of groups) {
        const category = group.category ?? '';
        const existing = byCategory.get(category);

        if (existing) {
            existing.push(group);
        } else {
            byCategory.set(category, [group]);
        }
    }

    return [...byCategory.values()].flat();
}

function getCheckoutTypeString(order: PrivateOrder): string {
    if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
        return $t(`%xG`);
    }
    if (order.data.checkoutMethod?.type === CheckoutMethodType.Delivery) {
        return $t(`%xH`, { name: order.data.checkoutMethod.name.length > 0 ? '(' + order.data.checkoutMethod.name + ')' : '' });
    }
    return '/';
}

function getCheckoutAddressString(order: PrivateOrder): string {
    if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
        return order.data.checkoutMethod.name;
    }
    if (order.data.checkoutMethod?.type === CheckoutMethodType.Delivery) {
        return order.data.address?.toString() ?? '??';
    }
    return '/';
}

/**
 * Base order columns (order number, date and customer details), shared by the
 * 'orderLines' and 'orders' sheets.
 */
function getOrderDetailGroups<R>(getOrder: (row: R) => PrivateOrder): OrdersExcelColumnGroup<R>[] {
    return [
        singleColumnGroup<R>({
            id: 'number',
            name: $t(`%xA`),
            category: columnCategories.order,
            getValue: row => ({
                value: getOrder(row).number ?? 0,
                style: integerStyle(),
            }),
        }),
        singleColumnGroup<R>({
            id: 'createdAt',
            name: $t(`%cB`),
            category: columnCategories.order,
            getValue: row => ({
                value: getOrder(row).createdAt,
                style: {
                    numberFormat: {
                        formatCode: 'dd/mm/yyyy hh:mm',
                    },
                },
            }),
        }),
        singleColumnGroup<R>({
            id: 'customer.firstName',
            name: $t(`%1MT`),
            category: columnCategories.customer,
            getValue: row => ({ value: getOrder(row).data.customer.firstName }),
        }),
        singleColumnGroup<R>({
            id: 'customer.lastName',
            name: $t(`%1MU`),
            category: columnCategories.customer,
            getValue: row => ({ value: getOrder(row).data.customer.lastName }),
        }),
        singleColumnGroup<R>({
            id: 'customer.email',
            name: $t(`%xB`),
            category: columnCategories.customer,
            getValue: row => ({ value: getOrder(row).data.customer.email }),
        }),
        singleColumnGroup<R>({
            id: 'customer.phone',
            name: $t(`%18Z`),
            category: columnCategories.customer,
            getValue: row => ({ value: getOrder(row).data.customer.phone }),
        }),
        singleColumnGroup<R>({
            id: 'customer.birthDay',
            name: $t(`Geboortedatum`),
            category: columnCategories.customer,
            getValue: (row) => {
                const birthDay = getOrder(row).data.customer.birthDay;
                if (!birthDay) {
                    return { value: '' };
                }
                return {
                    value: birthDay,
                    style: {
                        numberFormat: {
                            formatCode: 'dd/mm/yyyy',
                        },
                    },
                };
            },
        }),
        singleColumnGroup<R>({
            id: 'customer.gender',
            name: $t(`Gender`),
            category: columnCategories.customer,
            getValue: (row) => {
                const gender = getOrder(row).data.customer.gender;
                return { value: gender === Gender.Other ? '' : getGenderName(gender) };
            },
        }),
        singleColumnGroup<R>({
            id: 'customer.address',
            name: $t(`Adres klant`),
            description: $t(`Het adres van de klant zelf, niet het adres waarop geleverd wordt.`),
            category: columnCategories.customer,
            getValue: row => ({ value: getOrder(row).data.customer.address?.toString() ?? '' }),
        }),
    ];
}

/**
 * Order level answers: custom order fields (legacy) and record answers.
 * Deleted fields and records that still have answers in the exported orders are included as well.
 */
function getAnswerGroups<R>(webshop: Webshop, orders: PrivateOrder[], getOrder: (row: R) => PrivateOrder): OrdersExcelColumnGroup<R>[] {
    const groups: OrdersExcelColumnGroup<R>[] = [];
    const fieldIds = new Set<string>();
    const recordIds = new Set<string>();

    const addRecordGroup = (recordId: string, recordName: string, category: string, excelColumns: { name: string; width?: number; defaultCategory?: string }[]) => {
        groups.push({
            id: `recordAnswers.${recordId}`,
            name: recordName,
            category,
            columns: excelColumns.map((column, index) => ({
                id: `recordAnswers.${recordId}.${index}`,
                name: column.defaultCategory ? (column.defaultCategory + ' - ' + column.name) : column.name,
                defaultCategory: recordName,
                width: 0,
                getValue: (row: R) => ({
                    value: getOrder(row).data.recordAnswers.get(recordId)?.excelValues[index]?.value?.toString() ?? '',
                }),
            })),
        });
    };

    // Custom order fields (in the order they occur in the orders)
    for (const order of orders) {
        for (const answer of order.data.fieldAnswers) {
            const fieldId = answer.field.id;
            if (fieldIds.has(fieldId)) {
                continue;
            }
            fieldIds.add(fieldId);

            groups.push(singleColumnGroup<R>({
                id: `fieldAnswers.${fieldId}`,
                name: answer.field.name,
                category: columnCategories.questions,
                getValue: row => ({
                    value: getOrder(row).data.fieldAnswers.find(a => a.field.id === fieldId)?.answer ?? '',
                }),
            }));
        }
    }

    // Records configured on the webshop, grouped per record category (nested categories are flattened)
    for (const recordCategory of RecordCategory.flattenCategoriesWith(webshop.meta.recordCategories, record => record.excelColumns.length > 0)) {
        for (const record of recordCategory.records) {
            if (recordIds.has(record.id)) {
                continue;
            }
            recordIds.add(record.id);
            addRecordGroup(record.id, record.name.toString(), recordCategory.name.toString(), record.excelColumns);
        }
    }

    // Deleted records that still have answers in the exported orders
    for (const order of orders) {
        for (const answer of order.data.recordAnswers.values()) {
            if (recordIds.has(answer.settings.id)) {
                continue;
            }
            recordIds.add(answer.settings.id);
            addRecordGroup(answer.settings.id, answer.settings.name.toString(), columnCategories.questions, answer.excelColumns);
        }
    }

    return groups;
}

/**
 * One column per cart item option: product price choice, ticket date, option menus and
 * open questions of products. Deduplicated by name, exactly like the answers are entered.
 */
function getCartItemOptionGroups(webshop: Webshop, orders: PrivateOrder[]): OrdersExcelColumnGroup<OrderLineRow>[] {
    const names = new Map<string, string>(); // slug -> first seen name

    const addName = (name: string) => {
        const slug = Formatter.slug(name);
        if (!names.has(slug)) {
            names.set(slug, name);
        }
    };

    const addProduct = (product: Product) => {
        if (product.prices.length > 1) {
            addName($t(`%x8`));
        }

        if ((product.type === ProductType.Ticket || product.type === ProductType.Voucher) && product.dateRange) {
            addName($t(`%x9`));
        }

        for (const menu of product.optionMenus) {
            addName(menu.name);
        }

        for (const field of product.customFields) {
            addName(field.name);
        }
    };

    for (const product of webshop.productsInOrder) {
        addProduct(product);
    }

    // Include options of deleted products that are still used in the exported orders
    for (const order of orders) {
        for (const item of order.data.cart.items) {
            addProduct(item.product);
        }
    }

    return [...names.entries()].map(([slug, name]) => singleColumnGroup<OrderLineRow>({
        id: `option.${slug}`,
        name,
        category: columnCategories.item,
        getValue: ({ item }) => ({ value: getCartItemOptionValue(item, slug) }),
    }));
}

function getCartItemOptionValue(item: CartItem, slug: string): string {
    let value = '';

    // Product price choice
    if (item.product.prices.length > 1 && Formatter.slug($t(`%x8`)) === slug) {
        value = item.productPrice.name;
    }

    // Ticket date/time
    if ((item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) && item.product.dateRange && Formatter.slug($t(`%x9`)) === slug) {
        value = item.product.dateRange.toString();
    }

    // Option menu's
    for (const option of item.options) {
        if (Formatter.slug(option.optionMenu.name) === slug) {
            value = value ? (value + ', ' + option.option.name) : option.option.name;
        }
    }

    // Open questions
    for (const answer of item.fieldAnswers) {
        if (Formatter.slug(answer.field.name) === slug) {
            value = answer.answer;
        }
    }

    return value;
}

/**
 * One column per product combination (product + price + options) containing the ordered amount,
 * used in the 'orders' sheet.
 */
function getItemAmountGroups(webshop: Webshop, orders: PrivateOrder[]): OrdersExcelColumnGroup<PrivateOrder>[] {
    const names = new Map<string, string>(); // slug -> group name

    const addGroupingString = (group: string) => {
        const slug = Formatter.slug(group);
        if (!names.has(slug)) {
            names.set(slug, group);
        }
    };

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
                addGroupingString(cartItemGroupingString(CartItem.create({
                    product,
                    productPrice,
                    options: option
                        ? [CartItemOption.create({
                                option,
                                optionMenu: product.optionMenus[0],
                            })]
                        : [],
                })));
            }
        }
    }

    // Combinations in the exported orders (e.g. of deleted products)
    for (const order of orders) {
        for (const item of order.data.cart.items) {
            addGroupingString(cartItemGroupingString(item));
        }
    }

    return [...names.entries()].map(([slug, name]) => singleColumnGroup<PrivateOrder>({
        id: `item.${slug}`,
        name,
        category: columnCategories.orderedItems,
        width: name.length,
        getValue: (order) => {
            let amount = 0;
            for (const item of order.data.cart.items) {
                if (Formatter.slug(cartItemGroupingString(item)) === slug) {
                    amount += item.amount;
                }
            }
            return { value: amount };
        },
    }));
}

/**
 * Sheet with one row per ordered cart item.
 */
function getOrderLinesSheet(webshop: Webshop, orders: PrivateOrder[]): OrdersExcelSheet<OrderLineRow> {
    return {
        id: 'orderLines',
        name: $t(`%xP`),
        description: $t(`Bevat een rij per besteld artikel. Een bestelling met meerdere artikels wordt over meerdere rijen verdeeld.`),
        transform: orders => orders.flatMap(order => order.data.cart.items.map(item => ({ order, item }))),
        groups: [
            ...getOrderDetailGroups<OrderLineRow>(row => row.order),
            ...getAnswerGroups<OrderLineRow>(webshop, orders, row => row.order),
            singleColumnGroup<OrderLineRow>({
                id: 'comments',
                name: $t(`%Ve`),
                description: $t(`De notities die de klant zelf toevoegde bij het bestellen.`),
                category: columnCategories.order,
                getValue: row => ({ value: row.order.data.comments }),
            }),
            singleColumnGroup<OrderLineRow>({
                id: 'product',
                name: $t(`%Sc`),
                category: columnCategories.item,
                getValue: row => ({ value: row.item.product.name }),
            }),
            singleColumnGroup<OrderLineRow>({
                id: 'amount',
                name: $t(`%M4`),
                description: $t(`Het aantal bestelde stuks van dit artikel.`),
                category: columnCategories.item,
                getValue: row => ({
                    value: row.item.amount,
                    style: integerStyle(),
                }),
            }),
            singleColumnGroup<OrderLineRow>({
                id: 'unitPrice',
                name: $t(`%xC`),
                description: $t(`De prijs voor één stuk, inclusief de gekozen opties, maar zonder kortingen.`),
                category: columnCategories.item,
                getValue: row => ({
                    value: (row.item.getUnitPrice(row.order.data.cart) ?? 0) / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<OrderLineRow>({
                id: 'extraPrice',
                name: $t(`%xD`),
                description: $t(`De meerprijs die maar voor een deel van de stuks geldt, bijvoorbeeld de meerprijs van een bepaalde zetel.`),
                category: columnCategories.item,
                getValue: row => ({
                    value: (row.item.getPartialExtraPrice(row.order.data.cart) ?? 0) / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<OrderLineRow>({
                id: 'discount',
                name: $t(`%176`),
                description: $t(`De korting op dit artikel. Dit is een negatief bedrag.`),
                category: columnCategories.item,
                getValue: row => ({
                    value: (row.item.getPriceWithDiscounts() - row.item.getPriceWithoutDiscounts()) / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<OrderLineRow>({
                id: 'price',
                name: $t(`%1IP`),
                description: $t(`Het totaal voor dit artikel: de stukprijs maal het aantal, plus de meerprijs en na korting.`),
                category: columnCategories.item,
                getValue: row => ({
                    value: (row.item.getPriceWithDiscounts() ?? 0) / 10000,
                    style: currencyStyle(),
                }),
            }),
            ...getCartItemOptionGroups(webshop, orders),
            singleColumnGroup<OrderLineRow>({
                id: 'seats',
                name: $t(`%sB`),
                category: columnCategories.item,
                getValue: row => ({
                    value: row.item.seats.slice().sort(ReservedSeat.sort).map(s => s.getNameString(webshop, row.item.product)).join(', '),
                }),
            }),
            ...getCheckoutDetailGroups<OrderLineRow>(row => row.order),
            ...getOrderStatusGroups<OrderLineRow>(row => row.order),
        ],
    };
}

function getCheckoutDetailGroups<R>(getOrder: (row: R) => PrivateOrder): OrdersExcelColumnGroup<R>[] {
    return [
        singleColumnGroup<R>({
            id: 'checkoutMethod',
            name: $t(`%xE`),
            category: columnCategories.checkout,
            getValue: row => ({ value: getCheckoutTypeString(getOrder(row)) }),
        }),
        singleColumnGroup<R>({
            id: 'checkoutAddress',
            name: $t(`%xF`),
            description: $t(`Het gekozen afhaalpunt of het adres waarop geleverd wordt.`),
            category: columnCategories.checkout,
            getValue: row => ({ value: getCheckoutAddressString(getOrder(row)) }),
        }),
        singleColumnGroup<R>({
            id: 'timeSlotDate',
            name: $t(`%7R`),
            description: $t(`De dag waarop de bestelling wordt afgehaald of geleverd.`),
            category: columnCategories.checkout,
            getValue: (row) => {
                const timeSlot = getOrder(row).data.timeSlot;
                return { value: timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(timeSlot.date)) : '/' };
            },
        }),
        singleColumnGroup<R>({
            id: 'timeSlotTime',
            name: $t(`%1GD`),
            category: columnCategories.checkout,
            getValue: (row) => {
                const timeSlot = getOrder(row).data.timeSlot;
                return { value: timeSlot ? (Formatter.minutes(timeSlot.startTime) + ' - ' + Formatter.minutes(timeSlot.endTime)) : '/' };
            },
        }),
    ];
}

function getOrderStatusGroups<R>(getOrder: (row: R) => PrivateOrder): OrdersExcelColumnGroup<R>[] {
    return [
        singleColumnGroup<R>({
            id: 'paymentMethod',
            name: $t(`%M7`),
            category: columnCategories.payment,
            getValue: row => ({ value: PaymentMethodHelper.getNameCapitalized(getOrder(row).data.paymentMethod) }),
        }),
        singleColumnGroup<R>({
            id: 'paid',
            name: $t(`%1OD`),
            description: $t(`Of het volledige bedrag van de bestelling al betaald is.`),
            category: columnCategories.payment,
            getValue: row => ({ value: getOrder(row).openBalance <= 0 ? $t(`%1OD`) : $t(`%xI`) }),
        }),
        singleColumnGroup<R>({
            id: 'status',
            name: $t(`%1A`),
            description: $t(`De status van de bestelling zelf, bijvoorbeeld of ze al verwerkt of geannuleerd is.`),
            category: columnCategories.payment,
            getValue: row => ({ value: OrderStatusHelper.getName(getOrder(row).status) }),
        }),
        singleColumnGroup<R>({
            id: 'discountCodes',
            name: $t(`%1MX`),
            description: $t(`De kortingscodes die de klant gebruikte bij het bestellen.`),
            category: columnCategories.payment,
            getValue: row => ({ value: getOrder(row).data.discountCodes.map(d => d.code).join(', ') }),
        }),
    ];
}

/**
 * Sheet with one row per order.
 */
function getOrdersSheet(webshop: Webshop, orders: PrivateOrder[]): OrdersExcelSheet<PrivateOrder> {
    return {
        id: 'orders',
        name: $t(`%xQ`),
        description: $t(`Bevat een rij per bestelling, met een kolom per artikelcombinatie.`),
        transform: orders => orders,
        groups: [
            ...getOrderDetailGroups<PrivateOrder>(order => order),
            ...getAnswerGroups<PrivateOrder>(webshop, orders, order => order),
            singleColumnGroup<PrivateOrder>({
                id: 'comments',
                name: $t(`%Ve`),
                description: $t(`De notities die de klant zelf toevoegde bij het bestellen.`),
                category: columnCategories.order,
                getValue: order => ({ value: order.data.comments }),
            }),
            ...getCheckoutDetailGroups<PrivateOrder>(order => order),
            singleColumnGroup<PrivateOrder>({
                id: 'subtotal',
                name: $t(`%xJ`),
                description: $t(`Het totaal van alle bestelde artikels, zonder leverings- en administratiekosten.`),
                category: columnCategories.price,
                getValue: order => ({
                    value: order.data.cart.priceWithDiscounts / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<PrivateOrder>({
                id: 'discount',
                name: $t(`%176`),
                description: $t(`De korting van de kortingscodes op de volledige bestelling. Dit bedrag wordt van het subtotaal afgetrokken.`),
                category: columnCategories.price,
                getValue: order => ({
                    value: (order.data.appliedPercentageDiscount + order.data.fixedDiscount) / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<PrivateOrder>({
                id: 'deliveryPrice',
                name: $t(`%Sn`),
                category: columnCategories.price,
                getValue: order => ({
                    value: order.data.deliveryPrice / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<PrivateOrder>({
                id: 'administrationFee',
                name: $t(`%xK`),
                category: columnCategories.price,
                getValue: order => ({
                    value: order.data.administrationFee / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<PrivateOrder>({
                id: 'totalPrice',
                name: $t(`%xL`),
                description: $t(`Het bedrag dat de klant moet betalen: het subtotaal, min de korting, plus de leverings- en administratiekosten.`),
                category: columnCategories.price,
                getValue: order => ({
                    value: order.data.totalPrice / 10000,
                    style: currencyStyle(),
                }),
            }),
            ...getOrderStatusGroups<PrivateOrder>(order => order),
            ...getItemAmountGroups(webshop, orders),
        ],
    };
}

type TicketRow = {
    order: PrivateOrderWithTickets;
    ticket: TicketPublicPrivate;
};

/**
 * Sheet with one row per ticket.
 */
function getTicketsSheet(webshop: Webshop, organization: Organization): OrdersExcelSheet<TicketRow> {
    return {
        id: 'tickets',
        name: $t(`Tickets`),
        description: $t(`Bevat een rij per ticket, inclusief de geheime code waarmee de QR-code op het ticket kan aangemaakt worden.`),
        transform: orders => orders.flatMap(order =>
            order.tickets
                .filter(ticket => !ticket.deletedAt)
                .map(ticket => ticket.getPublic(order))
                .sort(TicketPublic.sort)
                .map(ticket => ({ order, ticket })),
        ),
        groups: [
            singleColumnGroup<TicketRow>({
                id: 'number',
                name: $t(`%xA`),
                category: columnCategories.order,
                getValue: row => ({
                    value: row.order.number ?? 0,
                    style: integerStyle(),
                }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'product',
                name: $t(`%Sc`),
                category: columnCategories.ticket,
                getValue: row => ({ value: row.ticket.getTitle() }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'description',
                name: $t(`Beschrijving`),
                description: $t(`De gekozen prijs en opties van het ticket.`),
                category: columnCategories.ticket,
                getValue: (row) => {
                    if (row.ticket.isSingle) {
                        return { value: row.ticket.items[0].descriptionWithoutDate.replaceAll('\n', ' - ') };
                    }
                    // A ticket for a whole order: list the ordered items
                    return { value: row.ticket.items.map(item => item.amount + 'x ' + item.product.name).join(', ') };
                },
            }),
            singleColumnGroup<TicketRow>({
                id: 'indexText',
                name: $t(`Nummer`),
                description: $t(`Het volgnummer of de naam die op het ticket staat`),
                category: columnCategories.ticket,
                getValue: row => ({ value: row.ticket.getIndexText() ?? '' }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'seat',
                name: $t(`%sA`),
                category: columnCategories.ticket,
                getValue: (row) => {
                    const product = row.ticket.items[0]?.product;
                    return { value: row.ticket.seat && product ? row.ticket.seat.getNameString(webshop, product) : '' };
                },
            }),
            singleColumnGroup<TicketRow>({
                id: 'ticketDate',
                name: $t(`%x9`),
                category: columnCategories.ticket,
                getValue: (row) => {
                    const dateRange = row.ticket.isSingle ? row.ticket.items[0].product.dateRange : null;
                    return { value: dateRange ? dateRange.toString() : '' };
                },
            }),
            singleColumnGroup<TicketRow>({
                id: 'price',
                name: $t(`%1IP`),
                category: columnCategories.ticket,
                getValue: row => ({
                    value: row.ticket.getPrice(row.order) / 10000,
                    style: currencyStyle(),
                }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'customer.firstName',
                name: $t(`%1MT`),
                category: columnCategories.customer,
                getValue: row => ({ value: row.order.data.customer.firstName }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'customer.lastName',
                name: $t(`%1MU`),
                category: columnCategories.customer,
                getValue: row => ({ value: row.order.data.customer.lastName }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'customer.email',
                name: $t(`%xB`),
                category: columnCategories.customer,
                getValue: row => ({ value: row.order.data.customer.email }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'scannedAt',
                name: $t(`Gescand op`),
                description: $t(`Leeg als het ticket nog niet gescand is.`),
                category: columnCategories.scanning,
                getValue: (row) => {
                    if (!row.ticket.scannedAt) {
                        return { value: '' };
                    }
                    return {
                        value: row.ticket.scannedAt,
                        style: {
                            numberFormat: {
                                formatCode: 'dd/mm/yyyy hh:mm',
                            },
                        },
                    };
                },
            }),
            singleColumnGroup<TicketRow>({
                id: 'scannedBy',
                name: $t(`Gescand door`),
                category: columnCategories.scanning,
                getValue: row => ({ value: row.ticket.scannedBy ?? '' }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'secret',
                name: $t(`Geheime code`),
                description: $t(`Unieke code van het ticket, kan gebruikt worden om zelf tickets met QR-code aan te maken`),
                category: columnCategories.qrCode,
                getValue: row => ({ value: row.ticket.secret }),
            }),
            singleColumnGroup<TicketRow>({
                id: 'url',
                name: $t(`Link`),
                description: $t(`Link waarop het ticket kan geopend worden. Dit is ook de inhoud van de QR-code op een ticket.`),
                category: columnCategories.qrCode,
                getValue: row => ({ value: 'https://' + webshop.getUrl(organization) + '/tickets/' + row.ticket.secret }),
            }),
        ],
    };
}

type ProductTotalRow = {
    amount: number;
    name: string;
    variant: string;
    grouping: string;
};

function getProductTotalRows(orders: PrivateOrder[]): ProductTotalRow[] {
    const counter: Map<string, ProductTotalRow> = new Map();

    for (const order of orders) {
        for (const item of order.data.cart.items) {
            const code = item.codeWithoutFields;
            let existing = counter.get(code);
            if (!existing) {
                existing = { amount: 0, name: item.product.name, variant: item.descriptionWithoutFields, grouping: cartItemGroupingString(item) };
                counter.set(code, existing);
            }
            existing.amount += item.amount;
        }
    }

    const arr = Array.from(counter.values());
    arr.sort((a, b) => Sorter.stack(Sorter.byStringProperty(a, b, 'name'), Sorter.byNumberProperty(a, b, 'amount')));
    return arr;
}

/**
 * Sheet with the total ordered amount per product combination.
 * Only included if there is at least one combination that differs from the product name itself.
 */
function getProductsSheet(): OrdersExcelSheet<ProductTotalRow> {
    return {
        id: 'products',
        name: $t(`%15p`),
        description: $t(`Bevat het totaal besteld aantal per combinatie van artikel, prijskeuze en opties.`),
        transform: orders => getProductTotalRows(orders),
        groups: [
            singleColumnGroup<ProductTotalRow>({
                id: 'product',
                name: $t(`%Sc`),
                getValue: row => ({ value: row.name }),
            }),
            singleColumnGroup<ProductTotalRow>({
                id: 'variant',
                name: $t(`%1y`),
                getValue: row => ({ value: row.variant }),
            }),
            singleColumnGroup<ProductTotalRow>({
                id: 'amount',
                name: $t(`%M4`),
                getValue: row => ({
                    value: row.amount,
                    style: integerStyle(),
                }),
            }),
        ],
    };
}

type OptionTotalRow = {
    amount: number;
    name: string;
    date: string;
    optionCounts: Map<string, number>;
    productPriceCounts: Map<string, number>;
};

function getProductDateString(product: Product): string {
    if ((product.type === ProductType.Ticket || product.type === ProductType.Voucher) && product.dateRange) {
        return Formatter.capitalizeFirstLetter(product.dateRange.toString());
    }
    return '';
}

function getOptionTotalRows(webshop: Webshop, orders: PrivateOrder[]): OptionTotalRow[] {
    const counter: Map<string, OptionTotalRow> = new Map();

    // First insert the products in order, so all products are visible, even without orders
    for (const product of webshop.productsInOrder) {
        const date = getProductDateString(product);
        const code = Formatter.slug(product.name + date);
        if (!counter.has(code)) {
            counter.set(code, { amount: 0, name: product.name, date, optionCounts: new Map(), productPriceCounts: new Map() });
        }
    }

    for (const order of orders) {
        for (const item of order.data.cart.items) {
            const date = getProductDateString(item.product);
            const code = Formatter.slug(item.product.name + date);

            let productData = counter.get(code);
            if (!productData) {
                productData = { amount: 0, name: item.product.name, date, optionCounts: new Map(), productPriceCounts: new Map() };
                counter.set(code, productData);
            }

            productData.amount += item.amount;

            if (item.productPrice.name) {
                const name = Formatter.slug(item.productPrice.name);
                productData.productPriceCounts.set(name, (productData.productPriceCounts.get(name) ?? 0) + item.amount);
            }

            for (const option of item.options) {
                const name = Formatter.slug(option.option.name);
                productData.optionCounts.set(name, (productData.optionCounts.get(name) ?? 0) + item.amount);
            }
        }
    }

    return Array.from(counter.values());
}

/**
 * Sheet with the total ordered amount per product, with a column per price choice and option.
 */
function getOptionsSheet(webshop: Webshop, orders: PrivateOrder[]): OrdersExcelSheet<OptionTotalRow> {
    const productPriceNames = new Map<string, string>(); // slug -> name
    const optionNames = new Map<string, string>(); // slug -> name

    for (const product of webshop.productsInOrder) {
        for (const price of product.prices) {
            const name = price.name || $t('%132');
            const slug = Formatter.slug(name);
            if (!productPriceNames.has(slug)) {
                productPriceNames.set(slug, name);
            }
        }

        for (const optionMenu of product.optionMenus) {
            for (const option of optionMenu.options) {
                const slug = Formatter.slug(option.name);
                if (!optionNames.has(slug)) {
                    optionNames.set(slug, option.name);
                }
            }
        }
    }

    // Add missing price choices and options of deleted products
    for (const order of orders) {
        for (const item of order.data.cart.items) {
            if (item.productPrice.name) {
                const name = item.productPrice.name;
                const slug = Formatter.slug(name);
                if (!productPriceNames.has(slug)) {
                    productPriceNames.set(slug, name);
                }
            }

            for (const option of item.options) {
                const slug = Formatter.slug(option.option.name);
                if (!optionNames.has(slug)) {
                    optionNames.set(slug, option.option.name);
                }
            }
        }
    }

    return {
        id: 'options',
        name: $t(`%xR`),
        description: $t(`Bevat het totaal besteld aantal per artikel, met een kolom per prijskeuze en optie.`),
        transform: orders => getOptionTotalRows(webshop, orders),
        groups: [
            singleColumnGroup<OptionTotalRow>({
                id: 'product',
                name: $t(`%Sc`),
                category: columnCategories.item,
                getValue: row => ({ value: row.name }),
            }),
            singleColumnGroup<OptionTotalRow>({
                id: 'date',
                name: $t(`%7R`),
                category: columnCategories.item,
                getValue: row => ({ value: row.date }),
            }),
            singleColumnGroup<OptionTotalRow>({
                id: 'total',
                name: $t(`%xL`),
                description: $t(`Het totaal besteld aantal van dit artikel.`),
                category: columnCategories.item,
                getValue: row => ({
                    value: row.amount,
                    style: integerStyle(),
                }),
            }),
            ...[...productPriceNames.entries()].map(([slug, name]) => singleColumnGroup<OptionTotalRow>({
                id: `price.${slug}`,
                name,
                description: $t(`Het aantal keer dat deze prijskeuze gekozen werd.`),
                category: columnCategories.priceChoices,
                getValue: row => ({
                    value: row.productPriceCounts.get(slug) ?? 0,
                    style: integerStyle(),
                }),
            })),
            ...[...optionNames.entries()].map(([slug, name]) => singleColumnGroup<OptionTotalRow>({
                id: `option.${slug}`,
                name,
                description: $t(`Het aantal keer dat deze optie gekozen werd.`),
                category: columnCategories.options,
                getValue: row => ({
                    value: row.optionCounts.get(slug) ?? 0,
                    style: integerStyle(),
                }),
            })),
        ],
    };
}

/**
 * All the sheets (with selectable column groups) available in the Excel export of webshop orders.
 */
export function getOrdersExcelSheets(webshop: Webshop, orders: PrivateOrderWithTickets[], organization: Organization, options?: { includeTickets?: boolean }): OrdersExcelSheet<any>[] {
    const sheets: OrdersExcelSheet<any>[] = [
        getOrderLinesSheet(webshop, orders),
        getOrdersSheet(webshop, orders),
    ];

    // Only include the tickets sheet for webshops with tickets
    if ((options?.includeTickets ?? true) && (webshop.hasTickets || orders.some(order => order.tickets.length > 0))) {
        sheets.push(getTicketsSheet(webshop, organization));
    }

    // Only include the product totals sheet if there is a combination that differs from the product name
    const hasVariant = getProductTotalRows(orders).some(row => row.grouping !== row.name);
    if (hasVariant) {
        sheets.push(getProductsSheet());
    }

    sheets.push(getOptionsSheet(webshop, orders));

    return sheets.map(sheet => ({
        ...sheet,
        groups: groupColumnsByCategory(sheet.groups),
    }));
}

/**
 * Convert the sheets to the format of `@stamhoofd/excel-writer`, so the export
 * can be generated with the same code as the backend Excel exports.
 */
export function getOrdersExcelDefinitions(webshop: Webshop, orders: PrivateOrderWithTickets[], organization: Organization): XlsxTransformerSheet<PrivateOrderWithTickets[], unknown>[] {
    return getOrdersExcelSheets(webshop, orders, organization).map((sheet: OrdersExcelSheet<any>) => ({
        id: sheet.id,
        name: sheet.name,
        transform: sheet.transform,
        columns: sheet.groups.map(group => toTransformerColumn(group)),
    }));
}

function toTransformerColumn<R>(group: OrdersExcelColumnGroup<R>): XlsxTransformerColumn<R> {
    if (group.columns.length === 1 && group.columns[0].id === group.id) {
        return group.columns[0];
    }

    // A group that expands to multiple Excel columns (e.g. address records): match on the group id
    return {
        match: (id: string) => id === group.id ? group.columns.map(column => ({ ...column })) : undefined,
    };
}
