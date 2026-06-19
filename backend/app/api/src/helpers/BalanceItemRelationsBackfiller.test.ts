import type { Organization, RegistrationPeriod, Webshop } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, Order, RegistrationFactory, RegistrationPeriodFactory, WebshopFactory } from '@stamhoofd/models';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, OrderData, ReduceablePrice, TranslatedString } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { backfillBalanceItemRelations } from './BalanceItemRelationsBackfiller.js';

describe('helper.BalanceItemRelationsBackfiller', () => {
    let period: RegistrationPeriod;

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2030, 11, 31),
        }).create();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    async function createOrder(organization: Organization, webshop: Webshop) {
        const order = new Order();
        order.organizationId = organization.id;
        order.webshopId = webshop.id;
        order.data = OrderData.create({});
        await order.save();
        return order;
    }

    it('fills member, group and group price relations for registration balance items', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const member = await new MemberFactory({ organization, firstName: 'John', lastName: 'Doe' }).create();
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

        expect(balanceItem.relations.size).toBe(0);

        await backfillBalanceItemRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.relations.get(BalanceItemRelationType.Member)).toMatchObject({ id: member.id });
        expect(updated?.relations.get(BalanceItemRelationType.Member)?.name.toString()).toBe('John Doe');
        expect(updated?.relations.get(BalanceItemRelationType.Group)).toMatchObject({ id: group.id });
        // Only one price configured, so no group price relation
        expect(updated?.relations.has(BalanceItemRelationType.GroupPrice)).toBe(false);
    });

    it('fills the group price relation when the group has multiple prices', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const member = await new MemberFactory({ organization }).create();
        const group = await new GroupFactory({ organization, period }).create();

        // Add a second price so the relation should be filled
        group.settings.prices.push(group.settings.prices[0].clone());
        group.settings.prices[1].id = uuidv4();
        group.settings.prices[1].name = new TranslatedString('Late price');
        group.settings.prices[1].price = ReduceablePrice.create({ price: 30_00 });
        await group.save();

        const registration = await new RegistrationFactory({ member, group, groupPrice: group.settings.prices[1] }).create();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: 30_00,
        }).create();

        await backfillBalanceItemRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.relations.get(BalanceItemRelationType.GroupPrice)).toMatchObject({ id: group.settings.prices[1].id });
    });

    it('copies the registration period dates onto the balance item', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const member = await new MemberFactory({ organization }).create();
        const group = await new GroupFactory({ organization, period }).create();
        const registration = await new RegistrationFactory({ member, group }).create();

        const startDate = new Date(2024, 7, 1);
        const endDate = new Date(2025, 6, 31);
        registration.startDate = startDate;
        registration.endDate = endDate;
        await registration.save();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: 25_00,
        }).create();

        await backfillBalanceItemRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.startDate?.getTime()).toBe(startDate.getTime());
        expect(updated?.endDate?.getTime()).toBe(endDate.getTime());
    });

    it('fills the webshop relation for order balance items', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        const webshop = await new WebshopFactory({ organizationId: organization.id, name: 'My webshop' }).create();
        const order = await createOrder(organization, webshop);

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            orderId: order.id,
            type: BalanceItemType.Order,
            amount: 1,
            unitPrice: 12_00,
        }).create();

        expect(balanceItem.relations.size).toBe(0);

        await backfillBalanceItemRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.relations.get(BalanceItemRelationType.Webshop)).toMatchObject({ id: webshop.id });
        expect(updated?.relations.get(BalanceItemRelationType.Webshop)?.name.toString()).toBe('My webshop');
    });

    it('does not overwrite existing relations', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const member = await new MemberFactory({ organization }).create();
        const group = await new GroupFactory({ organization, period }).create();
        const registration = await new RegistrationFactory({ member, group }).create();

        const existingRelations = new Map([
            [
                BalanceItemRelationType.Member,
                BalanceItemRelation.create({ id: member.id, name: new TranslatedString('Custom name') }),
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

        await backfillBalanceItemRelations();

        const updated = await BalanceItem.getByID(balanceItem.id);
        expect(updated?.relations.size).toBe(1);
        expect(updated?.relations.get(BalanceItemRelationType.Member)?.name.toString()).toBe('Custom name');
    });
});
