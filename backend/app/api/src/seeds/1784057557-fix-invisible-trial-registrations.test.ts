import { BalanceItemFactory, CachedBalance, GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import type { Group, Member, Organization, RegistrationPeriod } from '@stamhoofd/models';
import { EmailMocker } from '@stamhoofd/email';
import { BalanceItemStatus, BalanceItemType, ReceivableBalanceType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { fixInvisibleTrialRegistrations } from './1784057557-fix-invisible-trial-registrations.js';

describe('Seed.fix-invisible-trial-registrations', () => {
    let period: RegistrationPeriod;

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2030, 11, 31),
        }).create();
    });

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    async function initData() {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const group = await new GroupFactory({ organization, price: 2500 }).create();
        const member = await new MemberFactory({ organization }).create();

        return { organization, group, member };
    }

    /**
     * Recreates the state a trial registration was left in before the fix: the registration was never
     * marked valid, and its balance item stayed hidden (and was never billed).
     */
    async function createInvisibleTrialRegistration({ organization, group, member, trialUntil, createdAt }: { organization: Organization; group: Group; member: Member; trialUntil: Date; createdAt?: Date }) {
        const registration = await new RegistrationFactory({ member, group }).create();
        registration.registeredAt = null;
        registration.trialUntil = trialUntil;
        if (createdAt) {
            registration.createdAt = createdAt;
        }
        await registration.save();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: 2500,
            status: BalanceItemStatus.Hidden,
            dueAt: trialUntil,
            createdAt,
        }).create();

        return { registration, balanceItem };
    }

    test('It activates a trial registration and marks its balance item due, without shortening the trial', async () => {
        const { organization, group, member } = await initData();
        const trialUntil = new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000);
        const createdAt = new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000);
        createdAt.setMilliseconds(0);

        const { registration, balanceItem } = await createInvisibleTrialRegistration({ organization, group, member, trialUntil, createdAt });

        await fixInvisibleTrialRegistrations();

        // The registration is now visible in the registration lists and the member portal
        await registration.refresh();
        expect(registration.registeredAt).not.toBeNull();
        expect(registration.deactivatedAt).toBeNull();
        expect(registration.reservedUntil).toBeNull();

        // Attributed to the date the registration was really made, not the date the seed runs
        expect(registration.registeredAt).toEqual(createdAt);

        // The trial period is kept: it should not be shortened to now
        expect(registration.trialUntil).toEqual(trialUntil);

        // The amount is still owed, and is billed once the trial ends
        await balanceItem.refresh();
        expect(balanceItem.status).toBe(BalanceItemStatus.Due);
        expect(balanceItem.dueAt).toEqual(trialUntil);
        expect(balanceItem.pricePaid).toBe(0);

        // No confirmation email for a registration that was made a long time ago
        expect(registration.sendConfirmationEmail).toBe(false);
        expect(await EmailMocker.transactional.getSucceededEmails()).toEqual([]);
    });

    test('It leaves a registration whose trial already ended alone, so the member is not billed for a trial they never got', async () => {
        const { organization, group, member } = await initData();

        // Registered 7 months ago, trial ended 6 months ago
        const createdAt = new Date(new Date().getTime() - 210 * 24 * 60 * 60 * 1000);
        const trialUntil = new Date(new Date().getTime() - 180 * 24 * 60 * 60 * 1000);

        const { registration, balanceItem } = await createInvisibleTrialRegistration({ organization, group, member, trialUntil, createdAt });

        const result = await fixInvisibleTrialRegistrations();
        expect(result.expired).toBe(1);
        expect(result.fixed).toBe(0);

        // Untouched: activating it would put the full price on the member's outstanding balance
        // right away, because the dueAt of the balance item is in the past.
        await registration.refresh();
        expect(registration.registeredAt).toBeNull();

        await balanceItem.refresh();
        expect(balanceItem.status).toBe(BalanceItemStatus.Hidden);
        expect(balanceItem.priceOpen).toBe(0);

        const balances = await CachedBalance.balanceForObjects(organization.id, [member.id], ReceivableBalanceType.member);
        expect(balances.reduce((total, b) => total + b.priceOpen, 0)).toBe(0);
    });

    test('It skips a trial registration when the member was registered for the same group again', async () => {
        const { organization, group, member } = await initData();
        const trialUntil = new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000);

        const { registration, balanceItem } = await createInvisibleTrialRegistration({ organization, group, member, trialUntil });

        // The registration was invisible, so the member got registered for the same group again
        const duplicate = await new RegistrationFactory({ member, group }).create();
        expect(duplicate.registeredAt).not.toBeNull();

        const result = await fixInvisibleTrialRegistrations();
        expect(result.skipped).toBe(1);
        expect(result.fixed).toBe(0);

        // Untouched: activating it would give the member two active registrations for the same group
        await registration.refresh();
        expect(registration.registeredAt).toBeNull();

        await balanceItem.refresh();
        expect(balanceItem.status).toBe(BalanceItemStatus.Hidden);
    });

    test('It leaves a registration that is waiting for an online payment alone', async () => {
        const { organization, group, member } = await initData();

        // No trial: this registration is not activated because its payment is still pending
        const registration = await new RegistrationFactory({ member, group }).create();
        registration.registeredAt = null;
        registration.reservedUntil = new Date(new Date().getTime() + 30 * 60 * 1000);
        await registration.save();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: 2500,
            status: BalanceItemStatus.Hidden,
        }).create();

        const result = await fixInvisibleTrialRegistrations();
        expect(result.fixed).toBe(0);

        await registration.refresh();
        expect(registration.registeredAt).toBeNull();

        await balanceItem.refresh();
        expect(balanceItem.status).toBe(BalanceItemStatus.Hidden);
    });
});
