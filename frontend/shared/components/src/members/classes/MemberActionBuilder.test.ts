import { Group, GroupCategory, GroupSettings, GroupType, Organization, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, RegistrationPeriod } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { RegistrationActionBuilder } from '#registrations/classes/RegistrationActionBuilder.ts';
import { MemberActionBuilder } from './MemberActionBuilder';

function buildOrganization(period: RegistrationPeriod, groups: Group[] = [], categories: GroupCategory[] = []) {
    const rootCategory = GroupCategory.create({ id: 'root', categoryIds: categories.map(c => c.id) });

    return Organization.create({
        name: 'Test organization',
        uri: 'test-organization',
        period: OrganizationRegistrationPeriod.create({
            period,
            groups,
            settings: OrganizationRegistrationPeriodSettings.create({
                categories: [rootCategory, ...categories],
                rootCategoryId: rootCategory.id,
            }),
        }),
    });
}

function buildEventWaitingList(organizationId: string, periodId: string) {
    const eventGroup = Group.create({
        organizationId,
        periodId,
        type: GroupType.EventRegistration,
        settings: GroupSettings.create({}),
    });
    const waitingList = Group.create({
        organizationId,
        periodId,
        type: GroupType.WaitingList,
        settings: GroupSettings.create({}),
    });
    eventGroup.waitingList = waitingList;
    waitingList.parentGroup = eventGroup;

    return { eventGroup, waitingList };
}

// The invite actions only depend on groups, organizations and the resolved periods, so the
// other collaborators can stay empty stubs.
const builderFactories = {
    MemberActionBuilder: (waitingList: Group, organizations: Organization[]) => new MemberActionBuilder({
        present: (async () => {}) as any,
        context: {} as any,
        groups: [waitingList],
        platform: {} as any,
        organizations,
        platformFamilyManager: {} as any,
        owner: {},
        categories: [],
    }),
    RegistrationActionBuilder: (waitingList: Group, organizations: Organization[]) => new RegistrationActionBuilder({
        present: (async () => {}) as any,
        context: {} as any,
        groups: [waitingList],
        platform: {} as any,
        organizations,
        platformFamilyManager: {} as any,
        owner: {},
        categories: [],
    }),
};

function getInviteActions(builder: MemberActionBuilder | RegistrationActionBuilder) {
    return (builder as any).getInviteMemberForGroupActionsWithGroups() as { name: string }[];
}

describe.each(Object.entries(builderFactories))('%s.getInviteMemberForGroupActionsWithGroups', (_name, buildBuilder) => {
    test('offers invite actions for an event waiting list in an unresolvable period', () => {
        // Regression test for STA-1361: the event lies in a period that is not part of the
        // resolved organization periods (e.g. the next werkjaar, or an admin without full
        // access), so no period tree can be built. The event group must remain invitable.
        const currentPeriod = RegistrationPeriod.create({ id: 'period-current' });
        const eventPeriod = RegistrationPeriod.create({ id: 'period-next' });
        const organization = buildOrganization(currentPeriod);
        const { eventGroup, waitingList } = buildEventWaitingList(organization.id, eventPeriod.id);

        const builder = buildBuilder(waitingList, [organization]);
        const actions = getInviteActions(builder);

        expect(actions).toHaveLength(2);
        expect(builder.allGroupsLinkedToWaitingList.map(g => g.id)).toEqual([eventGroup.id]);
    });

    test('offers invite actions for an event waiting list in the current period', () => {
        const currentPeriod = RegistrationPeriod.create({ id: 'period-current' });
        const organization = buildOrganization(currentPeriod);
        const { eventGroup, waitingList } = buildEventWaitingList(organization.id, currentPeriod.id);

        const builder = buildBuilder(waitingList, [organization]);
        const actions = getInviteActions(builder);

        expect(actions).toHaveLength(2);
        expect(builder.allGroupsLinkedToWaitingList.map(g => g.id)).toEqual([eventGroup.id]);
    });

    test('offers invite actions for a membership waiting list via the category tree', () => {
        const currentPeriod = RegistrationPeriod.create({ id: 'period-current' });
        const waitingList = Group.create({
            periodId: currentPeriod.id,
            type: GroupType.WaitingList,
            settings: GroupSettings.create({}),
        });
        const membershipGroup = Group.create({
            periodId: currentPeriod.id,
            type: GroupType.Membership,
            settings: GroupSettings.create({}),
            waitingList,
        });
        const category = GroupCategory.create({ groupIds: [membershipGroup.id] });
        const organization = buildOrganization(currentPeriod, [membershipGroup], [category]);
        waitingList.organizationId = organization.id;
        membershipGroup.organizationId = organization.id;

        const builder = buildBuilder(waitingList, [organization]);
        const actions = getInviteActions(builder);

        expect(actions).toHaveLength(2);
        expect(builder.allGroupsLinkedToWaitingList.map(g => g.id)).toEqual([membershipGroup.id]);
    });

    test('offers no invite actions for a waiting list without linked groups', () => {
        const currentPeriod = RegistrationPeriod.create({ id: 'period-current' });
        const organization = buildOrganization(currentPeriod);
        const waitingList = Group.create({
            organizationId: organization.id,
            periodId: currentPeriod.id,
            type: GroupType.WaitingList,
            settings: GroupSettings.create({}),
        });

        const builder = buildBuilder(waitingList, [organization]);
        const actions = getInviteActions(builder);

        expect(actions).toHaveLength(0);
    });

    test('offers invite actions for an event waiting list without an organization in context', () => {
        // Platform admins in the admin app have no organization in context.
        const eventPeriod = RegistrationPeriod.create({ id: 'period-current' });
        const { eventGroup, waitingList } = buildEventWaitingList('organization-1', eventPeriod.id);

        const builder = buildBuilder(waitingList, []);
        const actions = getInviteActions(builder);

        expect(actions).toHaveLength(2);
        expect(builder.allGroupsLinkedToWaitingList.map(g => g.id)).toEqual([eventGroup.id]);
    });

    test('offers no invite actions for a membership waiting list without an organization in context', () => {
        const waitingList = Group.create({
            organizationId: 'organization-1',
            periodId: 'period-current',
            type: GroupType.WaitingList,
            settings: GroupSettings.create({}),
        });

        const builder = buildBuilder(waitingList, []);
        const actions = getInviteActions(builder);

        expect(actions).toHaveLength(0);
    });
});
