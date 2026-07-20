import { Database } from '@simonbackx/simple-database';
import type { Organization, Webshop } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, Order, OrganizationFactory, Payment, WebshopFactory } from '@stamhoofd/models';
import { compileToSQLFilter, SQL } from '@stamhoofd/sql';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { Address, BalanceItemType, Cart, CartItem, CartItemPrice, CheckoutMethodType, compileToInMemoryFilter, Customer, DiscountCode, OrderData, OrderStatus, PaymentMethod, PaymentStatus, privateOrderWithTicketsFilterCompilers, Product, ProductPrice, RecordCheckboxAnswer, RecordChoice, RecordChooseOneAnswer, RecordDateAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordTextAnswer, RecordType, WebshopTakeoutMethod, WebshopTimeSlot } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';

import { orderFilterCompilers } from '../../src/sql-filters/orders.js';

/**
 * These tests pin the in-memory order filters (used in the dashboard on locally cached orders) to the
 * backend SQL order filters (used by GetWebshopOrdersEndpoint). For every filter, the same StamhoofdFilter
 * is run through both engines against the exact same set of orders, and both must return the same order ids.
 *
 * The in-memory engine runs on the decoded PrivateOrder structures (privateOrderWithTicketsFilterCompilers).
 * The SQL engine runs a `SELECT * FROM webshop_orders WHERE <filter>` (orderFilterCompilers), the same way
 * the endpoint builds its query.
 *
 * Filters that only exist in one engine are intentionally not covered here (no counterpart to compare to):
 * - in-memory only: location, openBalance, ticketScanStatus, ticketScannedAt, ticketCount
 * - SQL only: organizationId, updatedAt, paymentMethod
 */
describe('Order filters (in-memory vs backend SQL parity)', () => {
    let organization: Organization;
    let webshop: Webshop;
    let nextNumber = 1;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        webshop = await new WebshopFactory({ organizationId: organization.id }).create();
    });

    beforeEach(async () => {
        // Start every test from an empty order set so the in-memory universe and the SQL universe are identical.
        await Database.delete('DELETE FROM `balance_item_payments`');
        await Database.delete('DELETE FROM `payments`');
        await Database.delete('DELETE FROM `balance_items`');
        await Database.delete('DELETE FROM `webshop_orders`');
        nextNumber = 1;
    });

    // --- order creation helpers ------------------------------------------------------------------------

    const address = () => Address.create({
        street: 'Demostraat',
        number: '15',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
    });

    /** A cart item with a fixed, deterministic price so totalPrice/amount are predictable. */
    function cartItem(options: { productId?: string; productPriceId?: string; amount?: number; unitPrice?: number } = {}) {
        const amount = options.amount ?? 1;
        const unitPrice = options.unitPrice ?? 0;
        return CartItem.create({
            product: Product.create({ id: options.productId ?? 'product-default' }),
            productPrice: ProductPrice.create({ id: options.productPriceId ?? 'price-default' }),
            amount,
            calculatedPrices: [CartItemPrice.create({ price: unitPrice * amount })],
        });
    }

    function orderData(options: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        timeSlot?: WebshopTimeSlot | null;
        checkoutMethod?: WebshopTakeoutMethod | null;
        discountCodes?: DiscountCode[];
        items?: CartItem[];
        recordAnswers?: Map<string, RecordCheckboxAnswer | RecordTextAnswer | RecordChooseOneAnswer | RecordMultipleChoiceAnswer | RecordDateAnswer>;
    } = {}): OrderData {
        return OrderData.create({
            customer: Customer.create({
                firstName: options.firstName ?? 'John',
                lastName: options.lastName ?? 'Doe',
                email: options.email ?? 'john@example.com',
                phone: options.phone ?? '+32412345678',
            }),
            timeSlot: options.timeSlot ?? null,
            checkoutMethod: options.checkoutMethod ?? null,
            discountCodes: options.discountCodes ?? [],
            cart: Cart.create({ items: options.items ?? [] }),
            recordAnswers: options.recordAnswers ?? new Map(),
        });
    }

    async function createOrder(options: {
        data?: OrderData;
        status?: OrderStatus;
        number?: number | null;
        validAt?: Date | null;
        createdAt?: Date;
    } = {}): Promise<Order> {
        const order = new Order();
        order.organizationId = organization.id;
        order.webshopId = webshop.id;
        order.data = options.data ?? orderData();
        order.number = options.number !== undefined ? options.number : nextNumber++;
        order.status = options.status ?? OrderStatus.Created;
        order.validAt = options.validAt !== undefined ? options.validAt : new Date();
        if (options.createdAt) {
            order.createdAt = options.createdAt;
        }
        await order.save();
        return order;
    }

    /** Attaches a balance item to an order (needed for amountToPay and to hang payments off). */
    async function addBalanceItem(order: Order, options: { unitPrice: number; amount?: number; pricePaid?: number }): Promise<BalanceItem> {
        const balanceItem = new BalanceItem();
        balanceItem.organizationId = organization.id;
        balanceItem.orderId = order.id;
        balanceItem.type = BalanceItemType.Order;
        balanceItem.amount = options.amount ?? 1;
        balanceItem.unitPrice = options.unitPrice;
        balanceItem.pricePaid = options.pricePaid ?? 0;
        await balanceItem.save();
        return balanceItem;
    }

    async function addPayment(balanceItem: BalanceItem, options: {
        method: PaymentMethod;
        price: number;
        status?: PaymentStatus;
        paidAt?: Date | null;
        transferDescription?: string | null;
    }): Promise<Payment> {
        const payment = new Payment();
        payment.method = options.method;
        payment.status = options.status ?? PaymentStatus.Succeeded;
        payment.organizationId = organization.id;
        payment.price = options.price;
        payment.paidAt = options.paidAt ?? null;
        payment.transferDescription = options.transferDescription ?? null;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.price = options.price;
        balanceItemPayment.organizationId = organization.id;
        await balanceItemPayment.save();

        return payment;
    }

    // --- parity harness --------------------------------------------------------------------------------

    async function runInMemory(filter: StamhoofdFilter): Promise<string[]> {
        const orders = await Order.where({ organizationId: organization.id });
        const structures = await Order.getPrivateStructures(orders);
        const runner = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);
        return structures.filter(s => s.number !== null && runner(s)).map(s => s.id).sort();
    }

    async function runSQL(filter: StamhoofdFilter): Promise<string[]> {
        const query = SQL
            .select(SQL.wildcard(Order.table))
            .from(SQL.table(Order.table))
            // Same base filter as GetWebshopOrdersEndpoint.buildQuery
            .where(await compileToSQLFilter({ organizationId: organization.id, number: { $neq: null } }, orderFilterCompilers))
            .where(await compileToSQLFilter(filter, orderFilterCompilers));

        const rows = await query.fetch();
        return Order.fromRows(rows, Order.table).map(o => o.id).sort();
    }

    /**
     * Asserts that both engines return exactly the expected orders. Comparing to an explicit expected set
     * (instead of only comparing the engines to each other) also guards against both engines being wrong
     * in the same way, or a filter accidentally matching everything / nothing.
     */
    async function expectFilter(filter: StamhoofdFilter, expected: Order[]) {
        const expectedIds = [...new Set(expected.map(o => o.id))].sort();
        const inMemoryIds = await runInMemory(filter);
        const sqlIds = await runSQL(filter);

        expect(inMemoryIds, 'in-memory result should match expected').toEqual(expectedIds);
        expect(sqlIds, 'backend SQL result should match expected').toEqual(expectedIds);
    }

    // --- simple columns --------------------------------------------------------------------------------

    describe('id', () => {
        it('$eq matches a single order', async () => {
            const a = await createOrder();
            const b = await createOrder();
            await expectFilter({ id: { $eq: a.id } }, [a]);
            await expectFilter({ id: { $eq: b.id } }, [b]);
        });

        it('$in matches multiple orders', async () => {
            const a = await createOrder();
            const b = await createOrder();
            const c = await createOrder();
            await expectFilter({ id: { $in: [a.id, c.id] } }, [a, c]);
        });

        it('$neq excludes a single order', async () => {
            const a = await createOrder();
            const b = await createOrder();
            await expectFilter({ id: { $neq: a.id } }, [b]);
        });
    });

    describe('webshopId', () => {
        it('$eq matches orders of the webshop', async () => {
            const a = await createOrder();
            const b = await createOrder();
            await expectFilter({ webshopId: { $eq: webshop.id } }, [a, b]);
            await expectFilter({ webshopId: { $eq: 'does-not-exist' } }, []);
        });
    });

    describe('status', () => {
        it('$eq / $in / $neq on the enum', async () => {
            const created = await createOrder({ status: OrderStatus.Created });
            const prepared = await createOrder({ status: OrderStatus.Prepared });
            const completed = await createOrder({ status: OrderStatus.Completed });

            await expectFilter({ status: { $eq: OrderStatus.Created } }, [created]);
            await expectFilter({ status: { $in: [OrderStatus.Created, OrderStatus.Completed] } }, [created, completed]);
            await expectFilter({ status: { $neq: OrderStatus.Prepared } }, [created, completed]);
        });
    });

    describe('number', () => {
        it('numeric comparisons', async () => {
            const a = await createOrder({ number: 10 });
            const b = await createOrder({ number: 20 });
            const c = await createOrder({ number: 30 });

            await expectFilter({ number: { $eq: 20 } }, [b]);
            await expectFilter({ number: { $gt: 15 } }, [b, c]);
            await expectFilter({ number: { $lt: 25 } }, [a, b]);
            await expectFilter({ number: { $in: [10, 30] } }, [a, c]);
        });
    });

    describe('createdAt', () => {
        it('date comparisons', async () => {
            const older = await createOrder({ createdAt: new Date('2023-01-01T12:00:00Z') });
            const newer = await createOrder({ createdAt: new Date('2024-01-01T12:00:00Z') });

            await expectFilter({ createdAt: { $lt: new Date('2023-06-01T00:00:00Z') } }, [older]);
            await expectFilter({ createdAt: { $gt: new Date('2023-06-01T00:00:00Z') } }, [newer]);
        });
    });

    describe('validAt', () => {
        it('$eq null / $neq null', async () => {
            const valid = await createOrder({ validAt: new Date('2024-01-01T12:00:00Z') });
            const invalid = await createOrder({ validAt: null });

            await expectFilter({ validAt: { $eq: null } }, [invalid]);
            await expectFilter({ validAt: { $neq: null } }, [valid]);
        });

        it('date comparison', async () => {
            const older = await createOrder({ validAt: new Date('2023-01-01T12:00:00Z') });
            const newer = await createOrder({ validAt: new Date('2024-01-01T12:00:00Z') });

            await expectFilter({ validAt: { $gt: new Date('2023-06-01T00:00:00Z') } }, [newer]);
            await expectFilter({ validAt: { $lt: new Date('2023-06-01T00:00:00Z') } }, [older]);
        });
    });

    // --- customer JSON ---------------------------------------------------------------------------------

    describe('name', () => {
        it('$eq and $contains (case-insensitive)', async () => {
            const john = await createOrder({ data: orderData({ firstName: 'John', lastName: 'Doe' }) });
            const jane = await createOrder({ data: orderData({ firstName: 'Jane', lastName: 'Roe' }) });

            await expectFilter({ name: { $eq: 'John Doe' } }, [john]);
            await expectFilter({ name: { $eq: 'john doe' } }, [john]);
            await expectFilter({ name: { $contains: 'oe' } }, [john, jane]);
            await expectFilter({ name: { $contains: 'jane' } }, [jane]);
        });
    });

    describe('email', () => {
        it('$eq and $contains', async () => {
            const a = await createOrder({ data: orderData({ email: 'alice@example.com' }) });
            const b = await createOrder({ data: orderData({ email: 'bob@other.org' }) });

            await expectFilter({ email: { $eq: 'alice@example.com' } }, [a]);
            await expectFilter({ email: { $contains: 'example.com' } }, [a]);
            await expectFilter({ email: { $contains: '@' } }, [a, b]);
        });
    });

    describe('phone', () => {
        it('$contains and $eq on a set phone number', async () => {
            const a = await createOrder({ data: orderData({ phone: '+32412345678' }) });
            const b = await createOrder({ data: orderData({ phone: '+32498765432' }) });

            await expectFilter({ phone: { $eq: '+32412345678' } }, [a]);
            await expectFilter({ phone: { $contains: '4123' } }, [a]);
            await expectFilter({ phone: { $contains: '3' } }, [a, b]);
        });
    });

    // --- cached columns --------------------------------------------------------------------------------

    describe('totalPrice', () => {
        it('numeric comparisons', async () => {
            const cheap = await createOrder({ data: orderData({ items: [cartItem({ unitPrice: 5_00, amount: 1 })] }) });
            const expensive = await createOrder({ data: orderData({ items: [cartItem({ unitPrice: 50_00, amount: 1 })] }) });

            await expectFilter({ totalPrice: { $eq: 5_00 } }, [cheap]);
            await expectFilter({ totalPrice: { $gt: 10_00 } }, [expensive]);
            await expectFilter({ totalPrice: { $lt: 10_00 } }, [cheap]);
        });
    });

    describe('amount', () => {
        it('numeric comparisons', async () => {
            const few = await createOrder({ data: orderData({ items: [cartItem({ amount: 1, unitPrice: 1_00 })] }) });
            const many = await createOrder({ data: orderData({ items: [cartItem({ amount: 5, unitPrice: 1_00 })] }) });

            await expectFilter({ amount: { $eq: 1 } }, [few]);
            await expectFilter({ amount: { $gt: 3 } }, [many]);
            await expectFilter({ amount: { $lte: 1 } }, [few]);
        });
    });

    // --- time slot -------------------------------------------------------------------------------------

    describe('time slot', () => {
        const slot = (options: { date: Date; startTime?: number; endTime?: number }) => WebshopTimeSlot.create({
            date: options.date,
            startTime: options.startTime ?? 12 * 60,
            endTime: options.endTime ?? 14 * 60,
        });

        it('timeSlotDate $eq null matches orders without a time slot', async () => {
            const withSlot = await createOrder({ data: orderData({ timeSlot: slot({ date: new Date('2024-05-10T00:00:00Z') }) }) });
            const without = await createOrder({ data: orderData({ timeSlot: null }) });

            await expectFilter({ timeSlotDate: { $eq: null } }, [without]);
            await expectFilter({ timeSlotDate: { $neq: null } }, [withSlot]);
        });

        // timeSlotStartTime / timeSlotEndTime hold numbers (minutes since midnight). Numeric comparisons
        // must work in both engines, and a missing time slot must behave like SQL NULL: matched by $eq null
        // and by $lt (NULL is the smallest), not matched by $gt or $neq null.
        it('timeSlotStartTime / timeSlotEndTime comparisons and null parity', async () => {
            const morning = await createOrder({ data: orderData({ timeSlot: slot({ date: new Date('2024-05-10T00:00:00Z'), startTime: 9 * 60, endTime: 11 * 60 }) }) });
            const evening = await createOrder({ data: orderData({ timeSlot: slot({ date: new Date('2024-05-10T00:00:00Z'), startTime: 18 * 60, endTime: 20 * 60 }) }) });
            const without = await createOrder({ data: orderData({ timeSlot: null }) });

            await expectFilter({ timeSlotStartTime: { $eq: null } }, [without]);
            await expectFilter({ timeSlotStartTime: { $neq: null } }, [morning, evening]);
            await expectFilter({ timeSlotStartTime: { $gt: 12 * 60 } }, [evening]);
            await expectFilter({ timeSlotStartTime: { $lt: 12 * 60 } }, [morning, without]);
            await expectFilter({ timeSlotEndTime: { $gt: 12 * 60 } }, [evening]);
            await expectFilter({ timeSlotEndTime: { $lt: 12 * 60 } }, [morning, without]);
        });
    });

    // --- checkout method -------------------------------------------------------------------------------

    describe('checkout method', () => {
        const takeout = (id: string, name = 'Pickup point') => WebshopTakeoutMethod.create({
            id,
            name,
            address: address(),
        });

        it('checkoutMethod (type) and checkoutMethodId, incl null parity', async () => {
            const a = await createOrder({ data: orderData({ checkoutMethod: takeout('method-a') }) });
            const b = await createOrder({ data: orderData({ checkoutMethod: takeout('method-b') }) });
            const without = await createOrder({ data: orderData({ checkoutMethod: null }) });

            await expectFilter({ checkoutMethodId: { $eq: 'method-a' } }, [a]);
            await expectFilter({ checkoutMethodId: { $eq: null } }, [without]);
            await expectFilter({ checkoutMethod: { $in: [CheckoutMethodType.Takeout] } }, [a, b]);
            await expectFilter({ checkoutMethod: { $eq: null } }, [without]);
        });
    });

    // --- discount codes --------------------------------------------------------------------------------

    describe('discountCodes.code', () => {
        // Codes are stored with mixed case on purpose: both $eq and $in on a JSON array must be
        // case-insensitive, exactly like the in-memory engine.
        it('$eq and $in match the codes in the array (case-insensitive)', async () => {
            const summer = await createOrder({ data: orderData({ discountCodes: [DiscountCode.create({ code: 'SUMMER' })] }) });
            const winter = await createOrder({ data: orderData({ discountCodes: [DiscountCode.create({ code: 'WINTER' })] }) });
            const none = await createOrder({ data: orderData({ discountCodes: [] }) });

            await expectFilter({ discountCodes: { code: { $eq: 'summer' } } }, [summer]);
            await expectFilter({ discountCodes: { code: { $in: ['summer', 'winter'] } } }, [summer, winter]);
            expect(none.id).toBeDefined();
        });
    });

    // --- cart items ($elemMatch) -----------------------------------------------------------------------

    describe('items', () => {
        it('$elemMatch on product / productPrice / amount', async () => {
            const apple = await createOrder({ data: orderData({ items: [cartItem({ productId: 'apple', productPriceId: 'apple-price', amount: 2, unitPrice: 1_00 })] }) });
            const pear = await createOrder({ data: orderData({ items: [cartItem({ productId: 'pear', productPriceId: 'pear-price', amount: 5, unitPrice: 1_00 })] }) });

            await expectFilter({ items: { $elemMatch: { product: { id: { $eq: 'apple' } } } } }, [apple]);
            await expectFilter({ items: { $elemMatch: { productPrice: { id: { $eq: 'pear-price' } } } } }, [pear]);
            await expectFilter({ items: { $elemMatch: { amount: { $gt: 3 } } } }, [pear]);
            await expectFilter({ items: { $elemMatch: { product: { id: { $in: ['apple', 'pear'] } } } } }, [apple, pear]);
        });
    });

    // --- record answers --------------------------------------------------------------------------------

    describe('record answers', () => {
        const RID = 'record-id-1';

        const checkbox = (selected: boolean) => new Map([[RID, RecordCheckboxAnswer.create({ settings: RecordSettings.create({ id: RID, type: RecordType.Checkbox }), selected })]]);
        const text = (value: string) => new Map([[RID, RecordTextAnswer.create({ settings: RecordSettings.create({ id: RID, type: RecordType.Text }), value })]]);
        const chooseOne = (choiceId: string) => new Map([[RID, RecordChooseOneAnswer.create({ settings: RecordSettings.create({ id: RID, type: RecordType.ChooseOne }), selectedChoice: RecordChoice.create({ id: choiceId }) })]]);
        const multipleChoice = (choiceIds: string[]) => new Map([[RID, RecordMultipleChoiceAnswer.create({ settings: RecordSettings.create({ id: RID, type: RecordType.MultipleChoice }), selectedChoices: choiceIds.map(id => RecordChoice.create({ id })) })]]);
        const date = (dateValue: Date | null) => new Map([[RID, RecordDateAnswer.create({ settings: RecordSettings.create({ id: RID, type: RecordType.Date }), dateValue })]]);

        it('checkbox: selected', async () => {
            const checked = await createOrder({ data: orderData({ recordAnswers: checkbox(true) }) });
            const unchecked = await createOrder({ data: orderData({ recordAnswers: checkbox(false) }) });

            await expectFilter({ recordAnswers: { [RID]: { selected: { $eq: true } } } }, [checked]);
            await expectFilter({ recordAnswers: { [RID]: { selected: { $eq: false } } } }, [unchecked]);
        });

        it('text value: $contains and $eq', async () => {
            const hello = await createOrder({ data: orderData({ recordAnswers: text('say hello world') }) });
            const bye = await createOrder({ data: orderData({ recordAnswers: text('goodbye') }) });

            await expectFilter({ recordAnswers: { [RID]: { value: { $contains: 'hello' } } } }, [hello]);
            await expectFilter({ recordAnswers: { [RID]: { value: { $eq: 'goodbye' } } } }, [bye]);
        });

        it('single choice: selectedChoice.id', async () => {
            const a = await createOrder({ data: orderData({ recordAnswers: chooseOne('choice-a') }) });
            const b = await createOrder({ data: orderData({ recordAnswers: chooseOne('choice-b') }) });

            await expectFilter({ recordAnswers: { [RID]: { selectedChoice: { id: { $eq: 'choice-a' } } } } }, [a]);
            await expectFilter({ recordAnswers: { [RID]: { selectedChoice: { id: { $in: ['choice-a', 'choice-b'] } } } } }, [a, b]);
        });

        it('multiple choice: selectedChoices.id', async () => {
            const ab = await createOrder({ data: orderData({ recordAnswers: multipleChoice(['choice-a', 'choice-b']) }) });
            const c = await createOrder({ data: orderData({ recordAnswers: multipleChoice(['choice-c']) }) });

            await expectFilter({ recordAnswers: { [RID]: { selectedChoices: { id: { $in: ['choice-a'] } } } } }, [ab]);
            await expectFilter({ recordAnswers: { [RID]: { selectedChoices: { id: { $in: ['choice-c'] } } } } }, [c]);
        });

        it('date value: comparisons and $eq null', async () => {
            const stored = await createOrder({ data: orderData({ recordAnswers: date(new Date('2023-06-10T14:30:00Z')) }) });
            const later = await createOrder({ data: orderData({ recordAnswers: date(new Date('2023-06-25T14:30:00Z')) }) });
            const nullDate = await createOrder({ data: orderData({ recordAnswers: date(null) }) });

            await expectFilter({ recordAnswers: { [RID]: { dateValue: { $gt: new Date('2023-06-20T00:00:00Z') } } } }, [later]);
            await expectFilter({ recordAnswers: { [RID]: { dateValue: { $eq: null } } } }, [nullDate]);
            expect(stored.id).toBeDefined();
        });

        // The whole reason isMappedToJSONValueInBackend exists: an unanswered record question (missing map key)
        // or a null answer value must behave in memory exactly like the SQL NULL the JSON extraction yields.
        describe('missing / null answer parity (the SQL NULL behaviour)', () => {
            it('$eq null matches both a null value and an unanswered question', async () => {
                const nullValue = await createOrder({ data: orderData({ recordAnswers: text('') }) });
                // Overwrite with an actual null text value
                const nullAnswer = await createOrder({ data: orderData({ recordAnswers: new Map([[RID, RecordTextAnswer.create({ settings: RecordSettings.create({ id: RID, type: RecordType.Text }), value: null })]]) }) });
                const unanswered = await createOrder({ data: orderData({ recordAnswers: new Map() }) });
                const answered = await createOrder({ data: orderData({ recordAnswers: text('something') }) });

                await expectFilter({ recordAnswers: { [RID]: { value: { $eq: null } } } }, [nullAnswer, unanswered]);
                expect(nullValue.id).toBeDefined();
                expect(answered.id).toBeDefined();
            });

            it('$lt matches smaller values, null and unanswered (null is the smallest)', async () => {
                const small = await createOrder({ data: orderData({ recordAnswers: date(new Date('2023-01-01T00:00:00Z')) }) });
                const big = await createOrder({ data: orderData({ recordAnswers: date(new Date('2025-01-01T00:00:00Z')) }) });
                const nullAnswer = await createOrder({ data: orderData({ recordAnswers: date(null) }) });
                const unanswered = await createOrder({ data: orderData({ recordAnswers: new Map() }) });

                await expectFilter({ recordAnswers: { [RID]: { dateValue: { $lt: new Date('2024-01-01T00:00:00Z') } } } }, [small, nullAnswer, unanswered]);
                expect(big.id).toBeDefined();
            });

            it('$contains never matches a null value or an unanswered question', async () => {
                const match = await createOrder({ data: orderData({ recordAnswers: text('hello world') }) });
                const nullAnswer = await createOrder({ data: orderData({ recordAnswers: new Map([[RID, RecordTextAnswer.create({ settings: RecordSettings.create({ id: RID, type: RecordType.Text }), value: null })]]) }) });
                const unanswered = await createOrder({ data: orderData({ recordAnswers: new Map() }) });

                await expectFilter({ recordAnswers: { [RID]: { value: { $contains: 'hello' } } } }, [match]);
                expect(nullAnswer.id).toBeDefined();
                expect(unanswered.id).toBeDefined();
            });
        });
    });

    // --- payments ($elemMatch) -------------------------------------------------------------------------

    describe('payments', () => {
        it('$elemMatch on method / price / transferDescription, ignoring failed payments', async () => {
            const transferOrder = await createOrder();
            const transferItem = await addBalanceItem(transferOrder, { unitPrice: 10_00, pricePaid: 10_00 });
            await addPayment(transferItem, { method: PaymentMethod.Transfer, price: 10_00, transferDescription: '+++123/456/789+++' });

            const cardOrder = await createOrder();
            const cardItem = await addBalanceItem(cardOrder, { unitPrice: 25_00, pricePaid: 25_00 });
            await addPayment(cardItem, { method: PaymentMethod.CreditCard, price: 25_00 });

            // Order whose only payment failed: both engines must ignore the failed payment.
            const failedOrder = await createOrder();
            const failedItem = await addBalanceItem(failedOrder, { unitPrice: 5_00, pricePaid: 0 });
            await addPayment(failedItem, { method: PaymentMethod.Transfer, price: 5_00, status: PaymentStatus.Failed });

            await expectFilter({ payments: { $elemMatch: { method: { $eq: PaymentMethod.Transfer } } } }, [transferOrder]);
            await expectFilter({ payments: { $elemMatch: { price: { $gt: 20_00 } } } }, [cardOrder]);
            await expectFilter({ payments: { $elemMatch: { transferDescription: { $contains: '123' } } } }, [transferOrder]);
        });
    });

    // --- amountToPay -----------------------------------------------------------------------------------

    describe('amountToPay', () => {
        // amountToPay = totalPrice - sum(balance item pricePaid). Every order here has a balance item so the
        // SQL SUM is not NULL (an order with no balance items would make amountToPay NULL in SQL but
        // totalPrice in memory, which is a separate, documented divergence).
        it('numeric comparisons', async () => {
            const fullyPaid = await createOrder({ data: orderData({ items: [cartItem({ unitPrice: 10_00, amount: 1 })] }) });
            await addBalanceItem(fullyPaid, { unitPrice: 10_00, pricePaid: 10_00 });

            const partlyPaid = await createOrder({ data: orderData({ items: [cartItem({ unitPrice: 10_00, amount: 1 })] }) });
            await addBalanceItem(partlyPaid, { unitPrice: 10_00, pricePaid: 4_00 });

            const unpaid = await createOrder({ data: orderData({ items: [cartItem({ unitPrice: 10_00, amount: 1 })] }) });
            await addBalanceItem(unpaid, { unitPrice: 10_00, pricePaid: 0 });

            await expectFilter({ amountToPay: { $eq: 0 } }, [fullyPaid]);
            await expectFilter({ amountToPay: { $gt: 0 } }, [partlyPaid, unpaid]);
            await expectFilter({ amountToPay: { $eq: 10_00 } }, [unpaid]);
        });
    });
});
