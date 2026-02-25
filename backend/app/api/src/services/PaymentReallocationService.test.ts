import { BalanceItem, BalanceItemPayment, MemberFactory, Organization, OrganizationFactory, Payment } from '@stamhoofd/models';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, PaymentMethod, PaymentStatus, ReceivableBalanceType, TranslatedString } from '@stamhoofd/structures';
import { PaymentReallocationService } from './PaymentReallocationService.js';
import { BalanceItemService } from './BalanceItemService.js';

let sharedOrganization: Organization | undefined;

async function getOrganization() {
    if (!sharedOrganization) {
        sharedOrganization = await new OrganizationFactory({}).create();
    }
    return sharedOrganization;
}

async function getMember() {
    return await new MemberFactory({
        organization: (await getOrganization()),
    }).create();
}

async function createItem(options: {
    objectId?: string;
    unitPrice: number;
    amount: number;
    status?: BalanceItemStatus;
    paid?: number[];
    pending?: number[];
    failed?: number[];
    pricePaid?: number;
    priceOpen?: number;
    pricePending?: number;
    dueAt?: Date | null;
    relations?: Partial<Record<BalanceItemRelationType, string>>;
}): Promise<BalanceItem> {
    const b = new BalanceItem();
    b.unitPrice = options.unitPrice;
    b.amount = options.amount;
    b.status = options.status ?? BalanceItemStatus.Due;
    b.pricePaid = options.paid?.reduce((a, b) => a + b, 0) ?? 0;
    b.pricePending = options.pending?.reduce((a, b) => a + b, 0) ?? 0;
    b.organizationId = (await getOrganization()).id;
    b.memberId = options.objectId ?? null;
    b.relations = new Map();
    b.dueAt = options.dueAt ?? null;

    if (options.relations) {
        for (const [type, id] of Object.entries(options.relations)) {
            b.relations.set(type as BalanceItemRelationType, BalanceItemRelation.create({
                id,
                name: new TranslatedString('Test ' + id),
            }));
        }
    }
    await b.save();

    for (const paid of options.paid ?? []) {
        const payment = new Payment();
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.organizationId = b.organizationId;
        payment.price = paid;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = b.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.price = paid;
        balanceItemPayment.organizationId = b.organizationId;
        await balanceItemPayment.save();
    }

    for (const pending of options.pending ?? []) {
        const payment = new Payment();
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Pending;
        payment.organizationId = b.organizationId;
        payment.price = pending;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = b.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.price = pending;
        balanceItemPayment.organizationId = b.organizationId;
        await balanceItemPayment.save();
    }

    for (const failed of options.failed ?? []) {
        const payment = new Payment();
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Failed;
        payment.organizationId = b.organizationId;
        payment.price = failed;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = b.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.price = failed;
        balanceItemPayment.organizationId = b.organizationId;
        await balanceItemPayment.save();
    }

    await BalanceItemService.updatePaidAndPending([b]);
    const balance = (await BalanceItem.getByID(b.id))!;

    await expectItem(balance, {
        pricePaid: options.pricePaid,
        priceOpen: options.priceOpen,
        pricePending: options.pricePending,
        paid: options.paid,
        pending: options.pending,
        failed: options.failed,
    });

    return balance;
}

async function expectItem(b: BalanceItem, options: { pricePaid?: number; priceOpen?: number; pricePending?: number; paid?: number[]; pending?: number[]; failed?: number[] }) {
    await BalanceItemService.updatePaidAndPending([b]);
    b = (await BalanceItem.getByID(b.id))!;

    const loaded = await BalanceItem.loadPayments([b]);

    const actualPaidList = loaded.balanceItemPayments.filter(bp => bp.balanceItemId === b.id && loaded.payments.find(p => p.status === PaymentStatus.Succeeded && p.id === bp.paymentId)).map(bp => bp.price);
    const actualPendingList = loaded.balanceItemPayments.filter(bp => bp.balanceItemId === b.id && loaded.payments.find(p => (p.status === PaymentStatus.Pending || p.status === PaymentStatus.Created) && p.id === bp.paymentId)).map(bp => bp.price);
    const actualFailedList = loaded.balanceItemPayments.filter(bp => bp.balanceItemId === b.id && loaded.payments.find(p => p.status === PaymentStatus.Failed && p.id === bp.paymentId)).map(bp => bp.price);

    if (options.paid !== undefined) {
        expect(actualPaidList).toIncludeSameMembers(options.paid);
    }

    if (options.pending !== undefined) {
        expect(actualPendingList).toIncludeSameMembers(options.pending);
    }

    if (options.failed !== undefined) {
        expect(actualFailedList).toIncludeSameMembers(options.failed);
    }

    if (options.pricePaid !== undefined) {
        expect(b.pricePaid).toBe(options.pricePaid);
    }
    if (options.priceOpen !== undefined) {
        expect(b.priceOpen).toBe(options.priceOpen);
    }
    if (options.pricePending !== undefined) {
        expect(b.pricePending).toBe(options.pricePending);
    }
}

describe('PaymentReallocationService', () => {
    describe('swapPayments', () => {
        it('Equal balance item payments', async () => {
            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [30_00],
                priceOpen: -30_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                priceOpen: 0,
                paid: [],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [30_00],
            });
        });

        it('Equal pending balance items', async () => {
            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                pending: [30_00],
                priceOpen: -30_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                pending: [],
                priceOpen: 30_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                priceOpen: 0,
                pending: [],
            });

            await expectItem(b2, {
                priceOpen: 0,
                pending: [30_00],
            });
        });

        it('Failed payments are not moved', async () => {
            const b1 = await createItem({
                unitPrice: -30_00,
                amount: 1,
                failed: [30_00],
                priceOpen: -30_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                priceOpen: 30_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                priceOpen: -30_00,
                failed: [30_00],
            });

            await expectItem(b2, {
                priceOpen: 30_00,
                pending: [],
            });
        });

        it('Larger negative balance', async () => {
            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [30_00],
                priceOpen: -30_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                paid: [],
                priceOpen: 15_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                priceOpen: -15_00,
                paid: [15_00],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [15_00],
            });
        });

        it('Larger positive balance', async () => {
            const b1 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [15_00],
                priceOpen: -15_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                priceOpen: 0,
                paid: [],
            });

            await expectItem(b2, {
                priceOpen: 15_00,
                paid: [15_00],
            });
        });

        it('Spits up payments', async () => {
            const b1 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [50_00],
                priceOpen: -50_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                paid: [20_00],
                priceOpen: -20_00, // This adds internal assert
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [30_00],
            });
        });

        it('Moves multiple payments', async () => {
            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [20_00, 5_00, 10_00],
                priceOpen: -35_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                paid: [],
                priceOpen: 15_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                priceOpen: -20_00,
                paid: [20_00],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [5_00, 10_00],
            });
        });

        it('Moves multiple payments in both directions', async () => {
            const b1 = await createItem({
                unitPrice: -30_00,
                amount: 1,
                paid: [],
                priceOpen: -30_00, // This adds internal assert
            });

            const b2 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                paid: [-20_00, -10_00],
                priceOpen: 45_00, // This adds internal assert
            });

            // Now do a swap
            await PaymentReallocationService.swapPayments(
                { balanceItem: b1, remaining: b1.priceOpen },
                { balanceItem: b2, remaining: b2.priceOpen },
            );

            await expectItem(b1, {
                priceOpen: 0,
                paid: [-20_00, -10_00],
            });

            await expectItem(b2, {
                priceOpen: 15_00,
                paid: [],
            });
        });
    });

    describe('reallocate', () => {
        it('Balances with same relations should move existing payments first', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [30_00],
                priceOpen: -30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 0,
                paid: [],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [30_00],
            });
        });

        it('Balances with different relations should create a reallocation payment', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [30_00],
                priceOpen: -30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'price2', // This one is different
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 0,
                paid: [30_00, -30_00],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [30_00],
            });
        });

        it.skip('Balances with different relations should create a reallocation payment with 3 items and remaining open should prefer most similar item', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 40_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [40_00],
                priceOpen: -40_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
            });

            const b3 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                paid: [],
                priceOpen: 15_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'price2', // This one is different
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 0,
                paid: [40_00, -40_00],
            });

            await expectItem(b2, {
                priceOpen: 5_00,
                paid: [25_00],
            });

            // b3 was more similar to b1 and takes all first
            await expectItem(b3, {
                priceOpen: 0,
                paid: [15_00],
            });
        });

        it('Balances with same amount should create a reallocation payment over different amounts with more than 2 different relations', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                paid: [],
                priceOpen: 15_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: -30_00,
                amount: 1,
                paid: [],
                priceOpen: -30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'price2', // This one is different
                    [BalanceItemRelationType.Member]: 'member2', // This one is different
                },
            });

            const b3 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 15_00,
                paid: [],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [-30_00],
            });

            await expectItem(b3, {
                priceOpen: 0,
                paid: [30_00],
            });
        });

        it('Balances with same relations are prioritized over same amount', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: -30_00,
                amount: 1,
                paid: [],
                priceOpen: -30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b3 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 0,
                paid: [30_00],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [-30_00],
            });

            await expectItem(b3, {
                priceOpen: 30_00,
                paid: [],
            });
        });

        it('Balances with one different relation are prioritized over same amount', async () => {
            const memberId = (await getMember()).id;

            const b3 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
            });

            const b1 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: -30_00,
                amount: 1,
                paid: [],
                priceOpen: -30_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'price2', // This one is different
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });
            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 0,
                paid: [30_00],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [-30_00],
            });

            await expectItem(b3, {
                priceOpen: 30_00,
                paid: [],
            });
        });

        it('Balances with different amount should not create a reallocation payment', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 40_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [40_00],
                priceOpen: -40_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
            });

            const b3 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                paid: [],
                priceOpen: 15_00, // This adds internal assert
                objectId: memberId,
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: -40_00,
                paid: [40_00],
            });

            await expectItem(b2, {
                priceOpen: 30_00,
                paid: [],
            });

            await expectItem(b3, {
                priceOpen: 15_00,
                paid: [],
            });
        });

        it('Balances with different amount should only create a reallocation payment if total sum is zero', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 40_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [40_00],
                priceOpen: -40_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
            });

            const b3 = await createItem({
                unitPrice: 10_00,
                amount: 1,
                paid: [],
                priceOpen: 10_00, // This adds internal assert
                objectId: memberId,
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 0,
                paid: [40_00, -40_00],
            });

            await expectItem(b2, {
                priceOpen: 0,
                paid: [30_00],
            });

            await expectItem(b3, {
                priceOpen: 0,
                paid: [10_00],
            });
        });

        it('Balances due in the future should not be reallocated', async () => {
            const memberId = (await getMember()).id;
            const b1 = await createItem({
                unitPrice: 40_00,
                amount: 1,
                status: BalanceItemStatus.Canceled,
                paid: [40_00],
                priceOpen: -40_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b2 = await createItem({
                unitPrice: 30_00,
                amount: 1,
                paid: [],
                priceOpen: 30_00, // This adds internal assert
                objectId: memberId,
                // This is due later, so it should be the last one to be paid
                dueAt: new Date('2050-01-01'),
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            const b3 = await createItem({
                unitPrice: 15_00,
                amount: 1,
                paid: [],
                priceOpen: 15_00, // This adds internal assert
                objectId: memberId,
                relations: {
                    [BalanceItemRelationType.Group]: 'group1',
                    [BalanceItemRelationType.GroupPrice]: 'defaultprice',
                    [BalanceItemRelationType.Member]: 'member1',
                },
            });

            await PaymentReallocationService.reallocate(
                (await getOrganization()).id,
                memberId,
                ReceivableBalanceType.member,
            );

            // Check if the balance items are now equal
            await expectItem(b1, {
                priceOpen: 0,
                paid: [],
            });

            await expectItem(b2, {
                priceOpen: 30_00,
                paid: [],
            });

            await expectItem(b3, {
                priceOpen: -25_00, // Paid too much
                paid: [40_00],
            });
        });
    });
});
