import { Toast } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { CartItem, CartItemOption, CheckoutMethodType, OrderStatusHelper, PaymentMethodHelper, PrivateOrder, ProductType, ReservedSeat, Webshop } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import XLSX from 'xlsx';

import { ExcelHelper, RowValue } from './ExcelHelper';

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

export class OrdersExcelExport {
    /**
     * List of all products for every order
     */
    static createOrderLines(webshop: Webshop, orders: PrivateOrder[]): XLSX.WorkSheet {
        /// Should we repeat all the duplicate fields for multiple lines in an order?
        const repeat = true;

        const answerColumns = new Map<string, number>();
        const answerNames: string[] = [];

        const optionColumns = new Map<string, number>();
        const optionNames: string[] = [];

        for (const order of orders) {
            for (const a of order.data.fieldAnswers) {
                if (!answerColumns.has(a.field.id)) {
                    answerColumns.set(a.field.id, answerNames.length);
                    answerNames.push(a.field.name);
                }
            }
        }

        // First add record settings in order
        for (const recordSettings of webshop.meta.recordCategories.flatMap(r => r.getAllRecords())) {
            if (!answerColumns.has(recordSettings.id)) {
                answerColumns.set(recordSettings.id, answerNames.length);
                const columns = recordSettings.excelColumns;
                for (const c of columns) {
                    answerNames.push(c.defaultCategory ? (c.defaultCategory + ' - ' + c.name) : c.name);
                }
            }
        }

        for (const product of webshop.productsInOrder) {
            // Produce prices
            if (product.prices.length > 1) {
                const name = $t(`d34e8bed-2fd2-4a01-b88f-94deab82d26f`);

                if (!optionColumns.has(Formatter.slug(name))) {
                    optionColumns.set(Formatter.slug(name), optionColumns.size);
                    optionNames.push(name);
                }
            }

            // Ticket date/time
            if ((product.type === ProductType.Ticket || product.type === ProductType.Voucher) && product.dateRange) {
                const name = $t(`3a58bc78-bf5e-4e9d-b9e1-98a06d0b6322`);

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
            for (const a of order.data.recordAnswers.values()) {
                if (!answerColumns.has(a.settings.id)) {
                    answerColumns.set(a.settings.id, answerNames.length);
                    const columns = a.excelColumns;
                    for (const c of columns) {
                        answerNames.push(c.defaultCategory ? (c.defaultCategory + ' - ' + c.name) : c.name);
                    }
                }
            }

            // Add all prodcuct options and variants
            for (const item of order.data.cart.items) {
                // Produce prices
                if (item.product.prices.length > 1) {
                    const name = $t(`d34e8bed-2fd2-4a01-b88f-94deab82d26f`);

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size);
                        optionNames.push(name);
                    }
                }

                // Ticket date/time
                if ((item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) && item.product.dateRange) {
                    const name = $t(`3a58bc78-bf5e-4e9d-b9e1-98a06d0b6322`);

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size);
                        optionNames.push(name);
                    }
                }

                // Produce options
                for (const menu of item.product.optionMenus) {
                    const name = menu.name;

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size);
                        optionNames.push(name);
                    }
                }

                // Open questions
                for (const field of item.product.customFields) {
                    const name = field.name;

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), optionColumns.size);
                        optionNames.push(name);
                    }
                }
            }
        }

        // Columns
        const wsData: RowValue[][] = [
            [
                $t(`17772225-f9c0-4707-9e2a-97f94de4e9d0`),
                $t(`5dd11b77-abf6-4449-ac3f-74ac1edb5d65`),
                $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
                $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
                $t(`2bc71d9a-c8d0-4f55-bf68-5dbb896d1f5b`),
                $t(`3174ba16-f035-4afd-a69f-74865e64ef34`),
                ...answerNames,
                $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
                $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
                $t(`9c07647c-3b5b-4c93-bfd9-e7c07ae51276`),
                $t(`0d8b9fa2-d70a-434b-817e-c5b2b3861d91`),
                $t(`40939025-cebb-4afb-90e9-847233cb256f`),
                $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
                $t(`54e32267-042e-4cfc-a423-63977769a98d`),
                ...optionNames,
                $t(`2a3d1996-17cd-4ef7-827b-63f2f9b5b84a`),

                // Duplicates
                $t(`402fe5ff-cf4e-4d31-b0db-1b8f5dcfebe3`),
                $t(`444e7f72-6435-4ae7-bb5d-3fc7e5e79dad`),
                $t(`112b7686-dffc-4ae9-9706-e3efcd34898f`),
                $t(`5a3e25de-683f-4a20-b02e-ebcc3aca89f6`),
                $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
                $t(`1c1933f1-fee4-4e7d-9c89-57593fd5bed3`),
                $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
                $t(`3697babf-4463-460f-95ee-683a40e5d46d`),
            ],
        ];

        for (const order of orders) {
            let checkoutType = '/';
            let address = '/';
            if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                checkoutType = $t(`cca905ff-7d00-4b9d-84c6-bda2bb5ea898`);
                address = order.data.checkoutMethod.name;
            }
            else if (order.data.checkoutMethod?.type === CheckoutMethodType.Delivery) {
                checkoutType = $t(`ce5b4d9a-7d2a-4e86-9362-a4ea90582053`, { name: order.data.checkoutMethod.name.length > 0 ? '(' + order.data.checkoutMethod.name + ')' : '' });
                address = order.data.address?.toString() ?? '??';
            }

            for (const [index, item] of order.data.cart.items.entries()) {
                const answers: RowValue[] = answerNames.map(a => '');
                const options: RowValue[] = optionNames.map(a => '');

                for (const a of order.data.fieldAnswers) {
                    const index = answerColumns.get(a.field.id);
                    if (index !== undefined) {
                        answers[index] = a.answer;
                    }
                }

                for (const a of order.data.recordAnswers.values()) {
                    const index = answerColumns.get(a.settings.id);
                    if (index !== undefined) {
                        const values = a.excelValues;
                        for (const [i, v] of values.entries()) {
                            answers[index + i] = v.value?.toString() ?? '';
                        }
                    }
                }

                // Product price
                if (item.product.prices.length > 1) {
                    const columnName = $t(`d34e8bed-2fd2-4a01-b88f-94deab82d26f`);
                    const index = optionColumns.get(Formatter.slug(columnName));
                    if (index !== undefined) {
                        options[index] = item.productPrice.name;
                    }
                }

                if ((item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) && item.product.dateRange) {
                    const columnName = $t(`3a58bc78-bf5e-4e9d-b9e1-98a06d0b6322`);
                    const index = optionColumns.get(Formatter.slug(columnName));
                    if (index !== undefined) {
                        options[index] = item.product.dateRange.toString();
                    }
                }

                // Option menu's
                for (const option of item.options) {
                    const menu = option.optionMenu;
                    const columnName = menu.name;
                    const index = optionColumns.get(Formatter.slug(columnName));
                    if (index !== undefined) {
                        if (options[index]) {
                            const value = options[index];

                            if (typeof value === 'object' && !(value instanceof Date)) {
                                value.value = value.value + ', ' + option.option.name;
                            }
                            else {
                                if (typeof value === 'string') {
                                    options[index] = value + ', ' + option.option.name;
                                }
                                else {
                                    // invalid!
                                }
                            }
                        }
                        else {
                            options[index] = option.option.name;
                        }
                    }
                }

                // Open fields
                for (const answer of item.fieldAnswers) {
                    const field = answer.field;
                    const columnName = field.name;
                    const index = optionColumns.get(Formatter.slug(columnName));
                    if (index !== undefined) {
                        options[index] = answer.answer;
                    }
                }

                const showDetails = index === 0 || repeat;
                wsData.push([
                    showDetails
                        ? {
                                value: order.number ?? 0,
                                format: '0',
                            }
                        : '',
                    {
                        value: order.createdAt,
                        format: 'dd/mm/yyyy hh:mm',
                    },
                    showDetails ? order.data.customer.firstName : '',
                    showDetails ? order.data.customer.lastName : '',
                    showDetails ? order.data.customer.email : '',
                    showDetails ? order.data.customer.phone : '',
                    ...answers,
                    showDetails ? order.data.comments : '',
                    {
                        value: item.amount,
                        format: '0',
                    },
                    {
                        value: (item.getUnitPrice(order.data.cart) ?? 0) / 10000,
                        format: '€0.00',
                    },
                    {
                        value: ((item.getPartialExtraPrice(order.data.cart) ?? 0)) / 10000,
                        format: '€0.00',
                    },
                    {
                        value: ((item.getPriceWithDiscounts() - item.getPriceWithoutDiscounts())) / 10000,
                        format: '€0.00',
                    },
                    {
                        value: (item.getPriceWithDiscounts() ?? 0) / 10000,
                        format: '€0.00',
                    },
                    item.product.name,
                    ...options,
                    item.seats.slice().sort(ReservedSeat.sort).map(s => s.getNameString(webshop, item.product)).join(', '),
                    checkoutType,
                    address,
                    order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : '/',
                    order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime) + ' - ' + Formatter.minutes(order.data.timeSlot.endTime) : '/',
                    PaymentMethodHelper.getNameCapitalized(order.data.paymentMethod),
                    order.payment?.paidAt === null ? $t(`04c630cb-ca58-4613-a25e-d69925e55c37`) : $t(`1c1933f1-fee4-4e7d-9c89-57593fd5bed3`),
                    OrderStatusHelper.getName(order.status),
                    order.data.discountCodes.map(d => d.code).join(', '),
                ]);
            }
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13,
        });
    }

    /**
     * List all orders
     */
    static createOrders(webshop: Webshop, orders: PrivateOrder[], shouldIncludeSettements: boolean): XLSX.WorkSheet {
        const answerColumns = new Map<string, number>();
        const answerNames: string[] = [];

        for (const order of orders) {
            for (const a of order.data.fieldAnswers) {
                if (!answerColumns.has(a.field.id)) {
                    answerColumns.set(a.field.id, answerNames.length);
                    answerNames.push(a.field.name);
                }
            }
        }

        // First add record settings in order
        for (const recordSettings of webshop.meta.recordCategories.flatMap(r => r.getAllRecords())) {
            if (!answerColumns.has(recordSettings.id)) {
                answerColumns.set(recordSettings.id, answerNames.length);
                const columns = recordSettings.excelColumns;
                for (const c of columns) {
                    answerNames.push(c.defaultCategory ? (c.defaultCategory + ' - ' + c.name) : c.name);
                }
            }
        }

        for (const order of orders) {
            for (const a of order.data.recordAnswers.values()) {
                if (!answerColumns.has(a.settings.id)) {
                    answerColumns.set(a.settings.id, answerNames.length);
                    const columns = a.excelColumns;
                    for (const c of columns) {
                        answerNames.push(c.defaultCategory ? (c.defaultCategory + ' - ' + c.name) : c.name);
                    }
                }
            }
        }

        const itemColumns = new Map<string, number>();
        const itemNames: (RowValue & { value: string })[] = [];

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
                        options: option
                            ? [CartItemOption.create({
                                    option,
                                    optionMenu: product.optionMenus[0],
                                })]
                            : [],
                    }));
                    const groupName = Formatter.slug(group);

                    if (!itemColumns.has(groupName)) {
                        itemColumns.set(groupName, itemColumns.size);
                        itemNames.push({
                            value: group,
                            width: group.length,
                        });
                    }
                }
            }
        }

        // Columns for products
        for (const order of orders) {
            for (const item of order.data.cart.items) {
                const group = cartItemGroupingString(item);
                const groupName = Formatter.slug(group);
                if (!itemColumns.has(groupName)) {
                    itemColumns.set(groupName, itemColumns.size);
                    itemNames.push({
                        value: group,
                        width: group.length,
                    });
                }
            }
        }

        // Columns
        const wsData: RowValue[][] = [
            [
                $t(`17772225-f9c0-4707-9e2a-97f94de4e9d0`),
                $t(`5dd11b77-abf6-4449-ac3f-74ac1edb5d65`),
                $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
                $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
                $t(`2bc71d9a-c8d0-4f55-bf68-5dbb896d1f5b`),
                $t(`3174ba16-f035-4afd-a69f-74865e64ef34`),
                ...answerNames,
                $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
                $t(`402fe5ff-cf4e-4d31-b0db-1b8f5dcfebe3`),
                $t(`444e7f72-6435-4ae7-bb5d-3fc7e5e79dad`),
                $t(`112b7686-dffc-4ae9-9706-e3efcd34898f`),
                $t(`5a3e25de-683f-4a20-b02e-ebcc3aca89f6`),
                $t(`26369a8f-8080-4f00-af46-576fdf563ced`),
                $t(`40939025-cebb-4afb-90e9-847233cb256f`),
                $t(`482bd766-39fa-4340-91b4-ae22a23d5fa5`),
                $t(`a0d99100-f225-416f-bcec-e25df9d651ac`),
                $t(`341172ee-281e-4458-aeb1-64ed5b2cc8bb`),
                $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
                $t(`1c1933f1-fee4-4e7d-9c89-57593fd5bed3`),
                $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
                $t(`3697babf-4463-460f-95ee-683a40e5d46d`),
                ...(shouldIncludeSettements ? [$t(`4ff3b4aa-8668-4287-bce3-b06cde51ddb7`), $t(`02b47907-73e2-4cb2-b398-784f6cbce23a`)] : []),
                ...itemNames,
            ],
        ];

        for (const order of orders) {
            let checkoutType = '/';
            let address = '/';
            if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                checkoutType = $t(`cca905ff-7d00-4b9d-84c6-bda2bb5ea898`);
                address = order.data.checkoutMethod.name;
            }
            else if (order.data.checkoutMethod?.type === CheckoutMethodType.Delivery) {
                checkoutType = $t(`ce5b4d9a-7d2a-4e86-9362-a4ea90582053`, { name: order.data.checkoutMethod.name.length > 0 ? '(' + order.data.checkoutMethod.name + ')' : '' });
                address = order.data.address?.toString() ?? '??';
            }

            const answers: RowValue[] = answerNames.map(a => '');

            for (const a of order.data.fieldAnswers) {
                const index = answerColumns.get(a.field.id);
                if (index !== undefined) {
                    answers[index] = a.answer;
                }
            }

            for (const a of order.data.recordAnswers.values()) {
                const index = answerColumns.get(a.settings.id);
                if (index !== undefined) {
                    const values = a.excelValues;
                    for (const [i, v] of values.entries()) {
                        answers[index + i] = v.value?.toString() ?? '';
                    }
                }
            }

            const itemAmounts: number[] = itemNames.map(a => 0);

            for (const item of order.data.cart.items) {
                const group = cartItemGroupingString(item);
                const groupName = Formatter.slug(group);
                const index = itemColumns.get(groupName);
                if (index !== undefined) {
                    itemAmounts[index] = (itemAmounts[index] ?? 0) + item.amount;
                }
            }

            wsData.push([
                {
                    value: order.number ?? 0,
                    format: '0',
                },
                {
                    value: order.createdAt,
                    format: 'dd/mm/yyyy hh:mm',
                },
                order.data.customer.firstName,
                order.data.customer.lastName,
                order.data.customer.email,
                order.data.customer.phone,
                ...answers,
                order.data.comments,
                checkoutType,
                address,
                order.data.timeSlot ? Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.data.timeSlot.date)) : '/',
                order.data.timeSlot ? Formatter.minutes(order.data.timeSlot.startTime) + ' - ' + Formatter.minutes(order.data.timeSlot.endTime) : '/',
                {
                    value: order.data.cart.priceWithDiscounts / 10000,
                    format: '€0.00',
                },
                {
                    value: (order.data.appliedPercentageDiscount + order.data.fixedDiscount) / 10000,
                    format: '€0.00',
                },
                {
                    value: order.data.deliveryPrice / 10000,
                    format: '€0.00',
                },
                {
                    value: order.data.administrationFee / 10000,
                    format: '€0.00',
                },
                {
                    value: order.data.totalPrice / 10000,
                    format: '€0.00',
                },
                PaymentMethodHelper.getNameCapitalized(order.data.paymentMethod),
                order.pricePaid < order.totalToPay ? $t(`04c630cb-ca58-4613-a25e-d69925e55c37`) : $t(`1c1933f1-fee4-4e7d-9c89-57593fd5bed3`),
                OrderStatusHelper.getName(order.status),
                order.data.discountCodes.map(d => d.code).join(', '),
                ...(shouldIncludeSettements
                    ? (order.payment?.settlement ? [Formatter.capitalizeFirstLetter(Formatter.dateWithDay(order.payment.settlement.settledAt)), order.payment.settlement.reference] : ['/', '/'])
                    : []
                ),
                ...itemAmounts,
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13,
        });
    }

    /**
     * List all amount per product variant
     */
    static createSettlements(webshop: Webshop, orders: PrivateOrder[]): XLSX.WorkSheet {
        // Columns
        const wsData: RowValue[][] = [
            [
                $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
                $t(`136b7ba4-7611-4ee4-a46d-60758869210f`),
                $t(`112b7686-dffc-4ae9-9706-e3efcd34898f`),
                $t(`7733f484-fc0e-46ff-b0a0-7b674d10015d`),
                $t(`548f0a30-cdd6-4e9a-9a3c-bdcb3afe11e5`),
                $t(`1e5893d7-5af8-4029-8a1c-da6294078e9d`),
            ],
        ];

        const counter: Map<string, { id: string; reference: string; settledAt: Date; amount: number; total: number; fees: number }> = new Map();

        for (const order of orders) {
            if (order.payment?.settlement) {
                const settlement = order.payment.settlement;

                const existing = counter.get(settlement.id);
                if (existing) {
                    existing.settledAt = settlement.settledAt;
                    existing.total = settlement.amount;
                    existing.amount += order.payment.price;
                    existing.fees += settlement.fee;
                }
                else {
                    counter.set(settlement.id, {
                        id: settlement.id,
                        reference: settlement.reference,
                        settledAt: settlement.settledAt,
                        amount: order.payment.price,
                        total: settlement.amount,
                        fees: settlement.fee,
                    });
                }
            }
        }

        // Sort by date
        const arr = Array.from(counter.values());
        arr.sort((a, b) => Sorter.byDateValue(a.settledAt, b.settledAt));

        for (const item of arr) {
            wsData.push([
                item.id,
                item.reference,
                Formatter.capitalizeFirstLetter(Formatter.dateWithDay(item.settledAt)),
                {
                    value: item.total / 10000,
                    format: '€0.00',
                },
                {
                    value: item.amount / 10000,
                    format: '€0.00',
                },
                {
                    value: item.fees / 10000,
                    format: '€0.00',
                },
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 20,
        });
    }

    /**
     * List all amount per product variant
     */
    static createProducts(webshop: Webshop, orders: PrivateOrder[]): XLSX.WorkSheet | null {
        // Columns
        const wsData: RowValue[][] = [
            [
                $t(`54e32267-042e-4cfc-a423-63977769a98d`),
                $t(`be748ea7-badc-48b6-ae7a-8eca6341dc08`),
                $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
            ],
        ];

        const counter: Map<string, { amount: number; name: string; variant: string; grouping: string }> = new Map();

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

        // Sort by amount
        const arr = Array.from(counter.values());
        arr.sort((a, b) => Sorter.stack(Sorter.byStringProperty(a, b, 'name'), Sorter.byNumberProperty(a, b, 'amount')));
        let hasVariant = false;

        for (const item of arr) {
            hasVariant = hasVariant || item.grouping !== item.name;
            wsData.push([
                item.name,
                item.variant,
                {
                    value: item.amount,
                    format: '0',
                },
            ]);
        }

        // If all variant rows are empty: return null
        if (!hasVariant) {
            return null;
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13,
        });
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
                const name = price.name || $t('e3ef8c27-f909-4725-b97b-2cbbd9f24bb5');
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
                    const name = item.productPrice.name || $t('e3ef8c27-f909-4725-b97b-2cbbd9f24bb5');

                    if (!productPriceColumns.has(Formatter.slug(name))) {
                        productPriceColumns.set(Formatter.slug(name), {
                            name,
                        });
                    }
                }

                for (const option of item.options) {
                    const name = option.option.name;

                    if (!optionColumns.has(Formatter.slug(name))) {
                        optionColumns.set(Formatter.slug(name), {
                            name,
                        });
                    }
                }
            }
        }

        const productPriceColumnsArr = Array.from(productPriceColumns.keys());
        const optionColumnsArr = Array.from(optionColumns.keys());

        // Columns
        const wsData: RowValue[][] = [
            [
                'Artikel',
                'Datum',
                'Totaal',
                ...productPriceColumnsArr.map(a => productPriceColumns.get(a)!.name),
                ...optionColumnsArr.map(a => optionColumns.get(a)!.name),
            ],
        ];

        for (const order of orders) {
            for (const item of order.data.cart.items) {
                let date = '';
                if ((item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher) && item.product.dateRange) {
                    date = Formatter.capitalizeFirstLetter(item.product.dateRange.toString());
                }
                const code = Formatter.slug(item.product.name + date);

                const productData = counter.get(code) ?? { amount: 0, name: item.product.name, date, optionCounts: new Map(), productPriceCounts: new Map() };
                counter.set(code, productData);

                productData.amount += item.amount;

                if (item.productPrice.name) {
                    const name = Formatter.slug(item.productPrice.name || 'Standaardtarief');
                    productData.productPriceCounts.set(name, (productData.productPriceCounts.get(name) ?? 0) + item.amount);
                }

                for (const option of item.options) {
                    const name = Formatter.slug(option.option.name);
                    productData.optionCounts.set(name, (productData.optionCounts.get(name) ?? 0) + item.amount);
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
                    format: '0',
                },
                ...productPriceColumnsArr.map((a) => {
                    const value = item.productPriceCounts.get(a);
                    return {
                        value: value ?? 0,
                        format: '0',
                    };
                }),
                ...optionColumnsArr.map((a) => {
                    const value = item.optionCounts.get(a);
                    return {
                        value: value ?? 0,
                        format: '0',
                    };
                }),
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13,
        });
    }

    static export(webshop: Webshop, orders: PrivateOrder[]) {
        const wb = XLSX.utils.book_new();

        const shouldIncludeSettements = false;

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createOrderLines(webshop, orders), $t(`1718783a-80df-4d97-a5b5-10c785abfba1`));
        XLSX.utils.book_append_sheet(wb, this.createOrders(webshop, orders, shouldIncludeSettements), $t(`f10a9486-34c7-46d8-950b-21fd9f41b2b4`));
        const products = this.createProducts(webshop, orders);

        if (products) {
            XLSX.utils.book_append_sheet(wb, products, $t('a2066dbc-3040-4c7d-a3f9-1f3580617542'));
        }
        XLSX.utils.book_append_sheet(wb, this.createOptions(webshop, orders), $t(`3f6039ff-e157-4762-b10d-93e2d2fe56ce`));

        if (shouldIncludeSettements) {
            XLSX.utils.book_append_sheet(wb, this.createSettlements(webshop, orders), $t(`b037949c-50c3-400e-9633-ffaca32c0b01`));
        }

        if (AppManager.shared.downloadFile) {
            const data: ArrayBuffer = XLSX.write(wb, { type: 'array' });
            const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            AppManager.shared.downloadFile(blob, $t(`b0c46199-2c76-4d8c-9737-08838097e62f`)).catch((e) => {
                Toast.fromError(e).show();
            });
        }
        else {
            XLSX.writeFile(wb, $t(`b0c46199-2c76-4d8c-9737-08838097e62f`));
        }
    }
}
