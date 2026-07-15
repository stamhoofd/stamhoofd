import { BalanceItemFactory, CachedBalance, MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { ReceivableBalanceType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';

describe('cron.cleanup-orphaned-cached-balances', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('deletes cached balances without any balance item and keeps the ones that still have balance items', async () => {
        const organization = await new OrganizationFactory({}).create();
        const memberWithItem = await new MemberFactory({ organization }).create();
        const orphanMember = await new MemberFactory({ organization }).create();

        await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: memberWithItem.id,
            amount: 1,
            unitPrice: 25_00,
        }).create();

        // Seed cached balances for both members. The orphan member gets a (zero) row even though
        // it has no balance items.
        await CachedBalance.updateForMembers(organization.id, [memberWithItem.id, orphanMember.id]);

        // A cached balance of a registration that no longer has balance items
        const orphanRegistration = new CachedBalance();
        orphanRegistration.organizationId = organization.id;
        orphanRegistration.objectId = uuidv4();
        orphanRegistration.objectType = ReceivableBalanceType.registration;
        await orphanRegistration.save();

        // A cached balance of a paying organization that no longer has balance items
        const orphanOrganization = new CachedBalance();
        orphanOrganization.organizationId = organization.id;
        orphanOrganization.objectId = uuidv4();
        orphanOrganization.objectType = ReceivableBalanceType.organization;
        await orphanOrganization.save();

        // Sanity check: all rows exist before cleanup
        expect(await CachedBalance.getForObjects([orphanMember.id], organization.id, ReceivableBalanceType.member)).toHaveLength(1);

        await CachedBalance.deleteOrphaned();

        // The member with a balance item is kept
        const remainingMembers = await CachedBalance.getForObjects(
            [memberWithItem.id, orphanMember.id],
            organization.id,
            ReceivableBalanceType.member,
        );
        expect(remainingMembers.map(b => b.objectId)).toEqual([memberWithItem.id]);

        // The orphaned registration and organization cached balances are deleted
        expect(await CachedBalance.getByID(orphanRegistration.id)).toBeUndefined();
        expect(await CachedBalance.getByID(orphanOrganization.id)).toBeUndefined();
    });

    test('keeps a user cached balance when a linked member still has balance items, but removes the user-without-members row', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const member = await new MemberFactory({ organization, user }).create();

        // The balance item belongs to the member, not directly to the user
        await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            amount: 1,
            unitPrice: 40_00,
        }).create();

        await CachedBalance.updateForMembers(organization.id, [member.id]);
        await CachedBalance.updateForUsers(organization.id, [user.id]);

        // Both a 'user' and a 'userWithoutMembers' row are created for the user
        const before = await CachedBalance.getForObjects([user.id], organization.id);
        expect(before.map(b => b.objectType).sort()).toEqual(
            [ReceivableBalanceType.user, ReceivableBalanceType.userWithoutMembers].sort(),
        );

        await CachedBalance.deleteOrphaned();

        // The 'user' row is kept (the linked member still has balance items), the
        // 'userWithoutMembers' row is deleted (the user has no direct balance items)
        const after = await CachedBalance.getForObjects([user.id], organization.id);
        expect(after.map(b => b.objectType)).toEqual([ReceivableBalanceType.user]);
    });
});
