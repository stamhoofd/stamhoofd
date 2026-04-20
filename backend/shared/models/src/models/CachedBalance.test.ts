import { BalanceItemStatus } from '../../../../../shared/structures/dist/BalanceItem.js';
import { ReceivableBalanceType } from '../../../../../shared/structures/dist/ReceivableBalance.js';
import { MemberFactory } from '../factories/MemberFactory.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { UserFactory } from '../factories/UserFactory.js';
import { BalanceItem } from './BalanceItem.js';
import { CachedBalance } from './CachedBalance.js';
import { Member } from './Member.js';

describe('CachedBalance', () => {
    const now = new Date('2024-05-01T00:00:00Z');

    beforeEach(() => {
        // Mock datetime
        vitest.useFakeTimers({ toFake: ['Date'] }).setSystemTime(now);
    });

    afterAll(() => {
        vitest.useRealTimers();
    });

    test('Balances for members are summed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({organization}).create();

        const balanceA = new BalanceItem();
        balanceA.dueAt = null
        balanceA.quantity = 2;
        balanceA.unitPrice = 1_00;
        balanceA.memberId = member.id;
        balanceA.organizationId = organization.id;
        balanceA.status = BalanceItemStatus.Due
        await balanceA.save();

        // Update cached balance for user.
        await CachedBalance.updateForMembers(organization.id, [member.id])
        const cached = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cached).toHaveLength(1);
        expect(cached[0].amountOpen).toBe(2_00);
        expect(cached[0].amountPaid).toBe(0);
        expect(cached[0].amountPending).toBe(0);
        expect(cached[0].nextDueAt).toBe(null);
    });

    test('Balances less than 7 days in the future are summed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({organization}).create();

        const balanceA = new BalanceItem();
        balanceA.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 6); // 6 days later
        balanceA.quantity = 1;
        balanceA.unitPrice = 1_00;
        balanceA.memberId = member.id;
        balanceA.organizationId = organization.id;
        balanceA.status = BalanceItemStatus.Due
        await balanceA.save();

        // Update cached balance for user.
        await CachedBalance.updateForMembers(organization.id, [member.id])
        const cached = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cached).toHaveLength(1);
        expect(cached[0].amountOpen).toBe(1_00);
        expect(cached[0].amountPaid).toBe(0);
        expect(cached[0].amountPending).toBe(0);
        expect(cached[0].nextDueAt).toEqual(null);
    });

    test('Balances more than 7 days in the future are not summed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({organization}).create();

        const balanceA = new BalanceItem();
        balanceA.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 8); // 8 days later
        balanceA.quantity = 1;
        balanceA.unitPrice = 1_00;
        balanceA.memberId = member.id;
        balanceA.organizationId = organization.id;
        balanceA.status = BalanceItemStatus.Due
        await balanceA.save();

        // Update cached balance for user.
        await CachedBalance.updateForMembers(organization.id, [member.id])
        const cached = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cached).toHaveLength(1);
        expect(cached[0].amountOpen).toBe(0);
        expect(cached[0].amountPaid).toBe(0);
        expect(cached[0].amountPending).toBe(0);
        expect(cached[0].nextDueAt).toEqual(balanceA.dueAt);
    });

    test('Paid balances more than 7 days in the future are summed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({organization}).create();

        const balanceA = new BalanceItem();
        balanceA.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 8); // 8 days later
        balanceA.quantity = 2;
        balanceA.unitPrice = 1_00;
        balanceA.memberId = member.id;
        balanceA.organizationId = organization.id;
        balanceA.status = BalanceItemStatus.Due
        balanceA.pricePaid = 2_00;
        await balanceA.save();

        // Update cached balance for user.
        await CachedBalance.updateForMembers(organization.id, [member.id])
        const cached = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cached).toHaveLength(1);
        expect(cached[0].amountOpen).toBe(0);
        expect(cached[0].amountPaid).toBe(2_00);
        expect(cached[0].amountPending).toBe(0);
        expect(cached[0].nextDueAt).toEqual(null);
    });

     test('Paid balances more than 7 days in the future are summed and due at is still set if only partially paid', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({organization}).create();

        const balanceA = new BalanceItem();
        balanceA.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 8); // 8 days later
        balanceA.quantity = 2;
        balanceA.unitPrice = 1_00;
        balanceA.memberId = member.id;
        balanceA.organizationId = organization.id;
        balanceA.status = BalanceItemStatus.Due
        balanceA.pricePaid = 1_00;
        await balanceA.save();

        // Update cached balance for user.
        await CachedBalance.updateForMembers(organization.id, [member.id])
        const cached = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cached).toHaveLength(1);
        expect(cached[0].amountOpen).toBe(0);
        expect(cached[0].amountPaid).toBe(1_00);
        expect(cached[0].amountPending).toBe(0);
        expect(cached[0].nextDueAt).toEqual(balanceA.dueAt);
    });

    test('Canceled items are not summed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({organization}).create();

        const balanceA = new BalanceItem();
        balanceA.dueAt = null;
        balanceA.quantity = 1;
        balanceA.unitPrice = 1_00;
        balanceA.memberId = member.id;
        balanceA.organizationId = organization.id;
        balanceA.status = BalanceItemStatus.Canceled
        await balanceA.save();

        // Update cached balance for user.
        await CachedBalance.updateForMembers(organization.id, [member.id])
        const cached = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cached).toHaveLength(1);
        expect(cached[0].amountOpen).toBe(0);
        expect(cached[0].amountPaid).toBe(0);
        expect(cached[0].amountPending).toBe(0);
    });

    test('Hidden items are not summed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({organization}).create();

        const balanceA = new BalanceItem();
        balanceA.dueAt = null;
        balanceA.quantity = 1;
        balanceA.unitPrice = 1_00;
        balanceA.memberId = member.id;
        balanceA.organizationId = organization.id;
        balanceA.status = BalanceItemStatus.Hidden
        await balanceA.save();

        // Update cached balance for user.
        await CachedBalance.updateForMembers(organization.id, [member.id])
        const cached = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cached).toHaveLength(1);
        expect(cached[0].amountOpen).toBe(0);
        expect(cached[0].amountPaid).toBe(0);
        expect(cached[0].amountPending).toBe(0);
    });

    describe('nextDueAt for users with members', () => {
        test('Two balance items in the future are merged if less than 7 days in the future', async () => {
            const organization = await new OrganizationFactory({}).create();
            const member = await new MemberFactory({organization}).create();
            const user = await new UserFactory({organization}).create();

            // Link member with user
            await Member.users.reverse('members').link(user, [member]);

            const balanceA = new BalanceItem();
            balanceA.dueAt = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour later
            balanceA.quantity = 1;
            balanceA.unitPrice = 1_00;
            balanceA.memberId = member.id;
            balanceA.organizationId = organization.id;
            balanceA.status = BalanceItemStatus.Due
            await balanceA.save();

            const balanceB = new BalanceItem();
            balanceB.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 2); // 2 hours later
            balanceB.quantity = 1;
            balanceB.unitPrice = 1_00;
            balanceB.userId = user.id;
            balanceB.organizationId = organization.id;
            balanceB.status = BalanceItemStatus.Due
            await balanceB.save();

            // Update cached balance for user.
            await CachedBalance.updateForMembers(organization.id, [member.id])
            await CachedBalance.updateForUsers(organization.id, [user.id])
            {
                const cached = await CachedBalance.getForObjects([user.id], organization.id, ReceivableBalanceType.user);
                expect(cached).toHaveLength(1);
                expect(cached[0].amountOpen).toBe(2_00);
                expect(cached[0].amountPaid).toBe(0);
                expect(cached[0].amountPending).toBe(0);
                expect(cached[0].nextDueAt).toBe(null);
            }

            {
                const cached = await CachedBalance.getForObjects([user.id], organization.id, ReceivableBalanceType.userWithoutMembers);
                expect(cached).toHaveLength(1);
                expect(cached[0].amountOpen).toBe(1_00);
                expect(cached[0].amountPaid).toBe(0);
                expect(cached[0].amountPending).toBe(0);
                expect(cached[0].nextDueAt).toBe(null);
            }
        });

        test('[Regression] Two balance items more than 7 days in the future set correct nextDueAt', async () => {
            const organization = await new OrganizationFactory({}).create();
            const member = await new MemberFactory({organization}).create();
            const user = await new UserFactory({organization}).create();

            // Link member with user
            await Member.users.reverse('members').link(user, [member]);

            const balanceA = new BalanceItem();
            balanceA.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 8); // 8 days later
            balanceA.quantity = 1;
            balanceA.unitPrice = 1_00;
            balanceA.memberId = member.id;
            balanceA.organizationId = organization.id;
            balanceA.status = BalanceItemStatus.Due
            await balanceA.save();

            const balanceB = new BalanceItem();
            balanceB.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 9); // 9 days later
            balanceB.quantity = 1;
            balanceB.unitPrice = 1_00;
            balanceB.userId = user.id;
            balanceB.organizationId = organization.id;
            balanceB.status = BalanceItemStatus.Due
            await balanceB.save();

            // Update cached balance for user.
            await CachedBalance.updateForMembers(organization.id, [member.id])
            await CachedBalance.updateForUsers(organization.id, [user.id])
            {
                const cached = await CachedBalance.getForObjects([user.id], organization.id, ReceivableBalanceType.user);
                expect(cached).toHaveLength(1);
                expect(cached[0].amountOpen).toBe(0);
                expect(cached[0].amountPaid).toBe(0);
                expect(cached[0].amountPending).toBe(0);
                expect(cached[0].nextDueAt).toEqual(balanceA.dueAt);
            }

            {
                const cached = await CachedBalance.getForObjects([user.id], organization.id, ReceivableBalanceType.userWithoutMembers);
                expect(cached).toHaveLength(1);
                expect(cached[0].amountOpen).toBe(0);
                expect(cached[0].amountPaid).toBe(0);
                expect(cached[0].amountPending).toBe(0);
                expect(cached[0].nextDueAt).toEqual(balanceB.dueAt);
            }

            // Advance time with one day, balanceA is now less than 7 days in the future and should be included in the cached balance.
            // nextDueAt should be different and set to balanceB.dueAt
            vitest.setSystemTime(new Date(now.getTime() + 1000 * 60 * 60 * 24 * 1))
            await CachedBalance.updateForMembers(organization.id, [member.id])
            await CachedBalance.updateForUsers(organization.id, [user.id])
            const cachedAfter = await CachedBalance.getForObjects([user.id], organization.id, ReceivableBalanceType.user);
            expect(cachedAfter).toHaveLength(1);
            expect(cachedAfter[0].amountOpen).toBe(1_00);
            expect(cachedAfter[0].amountPaid).toBe(0);
            expect(cachedAfter[0].amountPending).toBe(0);
            expect(cachedAfter[0].nextDueAt).toEqual(balanceB.dueAt);
        });

        test('Two balance items more than 7 days in the future that are partially paid are summed correctly', async () => {
            const organization = await new OrganizationFactory({}).create();
            const member = await new MemberFactory({organization}).create();
            const user = await new UserFactory({organization}).create();

            // Link member with user
            await Member.users.reverse('members').link(user, [member]);

            const balanceA = new BalanceItem();
            balanceA.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 8); // 8 days later
            balanceA.quantity = 1;
            balanceA.unitPrice = 1_00;
            balanceA.memberId = member.id;
            balanceA.organizationId = organization.id;
            balanceA.pricePaid = 50;
            balanceA.status = BalanceItemStatus.Due
            await balanceA.save();

            const balanceB = new BalanceItem();
            balanceB.dueAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 9); // 9 days later
            balanceB.quantity = 1;
            balanceB.unitPrice = 1_00;
            balanceB.userId = user.id;
            balanceB.organizationId = organization.id;
            balanceB.pricePaid = 50;
            balanceB.status = BalanceItemStatus.Due
            await balanceB.save();

            // Update cached balance for user.
            await CachedBalance.updateForMembers(organization.id, [member.id])
            await CachedBalance.updateForUsers(organization.id, [user.id])
            const cached = await CachedBalance.getForObjects([user.id], organization.id, ReceivableBalanceType.user);
            expect(cached).toHaveLength(1);
            expect(cached[0].amountOpen).toBe(0);
            expect(cached[0].amountPaid).toBe(1_00);
            expect(cached[0].amountPending).toBe(0);
            expect(cached[0].nextDueAt).toEqual(balanceA.dueAt);
        });
    });
});
