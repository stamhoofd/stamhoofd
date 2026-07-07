import type { RegistrationPeriod } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, GroupFactory, MemberFactory, MemberPlatformMembership, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, TranslatedString } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { backfillRegistrationPeriodRelations } from './RegistrationPeriodRelationBackfiller.js';

describe('helper.RegistrationPeriodRelationBackfiller', () => {
    let period: RegistrationPeriod;

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2024, 0, 1),
            endDate: new Date(2025, 11, 31),
        }).create();

        // A deterministic name so we can assert on it.
        period.customName = 'Werkjaar 2024-2025';
        await period.save();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    it('fills the registration period relation for registration balance items', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const member = await new MemberFactory({ organization }).create();
        const group = await new GroupFactory({ organization, period }).create();
        const registration = await new RegistrationFactory({ member, group }).create();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: 25_00,
        }).create();

        expect(balanceItem.relations.has(BalanceItemRelationType.RegistrationPeriod)).toBe(false);

        await backfillRegistrationPeriodRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.relations.get(BalanceItemRelationType.RegistrationPeriod)).toMatchObject({ id: period.id });
        expect(updated?.relations.get(BalanceItemRelationType.RegistrationPeriod)?.name.toString()).toBe('Werkjaar 2024-2025');
    });

    it('fills the registration period relation for platform membership balance items', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        const member = await new MemberFactory({ organization }).create();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            type: BalanceItemType.PlatformMembership,
            amount: 1,
            unitPrice: 15_00,
        }).create();

        const membership = new MemberPlatformMembership();
        membership.memberId = member.id;
        membership.membershipTypeId = uuidv4();
        membership.organizationId = organization.id;
        membership.periodId = period.id;
        membership.startDate = new Date(2024, 0, 1);
        membership.endDate = new Date(2025, 11, 31);
        membership.balanceItemId = balanceItem.id;
        await membership.save();

        await backfillRegistrationPeriodRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.relations.get(BalanceItemRelationType.RegistrationPeriod)).toMatchObject({ id: period.id });
        expect(updated?.relations.get(BalanceItemRelationType.RegistrationPeriod)?.name.toString()).toBe('Werkjaar 2024-2025');
    });

    it('does not overwrite an existing registration period relation', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const member = await new MemberFactory({ organization }).create();
        const group = await new GroupFactory({ organization, period }).create();
        const registration = await new RegistrationFactory({ member, group }).create();

        const existingRelations = new Map([
            [
                BalanceItemRelationType.RegistrationPeriod,
                BalanceItemRelation.create({ id: period.id, name: new TranslatedString('Custom period name') }),
            ],
        ]);

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: 25_00,
            relations: existingRelations,
        }).create();

        await backfillRegistrationPeriodRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.relations.get(BalanceItemRelationType.RegistrationPeriod)?.name.toString()).toBe('Custom period name');
    });
});
