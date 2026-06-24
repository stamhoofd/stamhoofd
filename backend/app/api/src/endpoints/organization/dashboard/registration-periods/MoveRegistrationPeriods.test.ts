import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationFactory, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { Group, GroupCategory, GroupCategorySettings, GroupType, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, OrganizationRegistrationPeriodSettings, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';
import { PatchOrganizationRegistrationPeriodsEndpoint } from './PatchOrganizationRegistrationPeriodsEndpoint.js';

import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

const endpoint = new PatchOrganizationRegistrationPeriodsEndpoint();

describe('Endpoint.PatchOrganizationRegistrationPeriodsEndpoint.MoveRegistrationPeriods', () => {
    let period: RegistrationPeriod;
    let organization: Organization;
    let organizationRegistrationPeriod: OrganizationRegistrationPeriod;
    let token: Token;
    let allGroupsToken: Token;

    describe('Organization mode', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'organization');
        });

        beforeAll(async () => {
            period = await new RegistrationPeriodFactory({}).create();
            organization = await new OrganizationFactory({ period }).create();
            period.organizationId = organization.id;
            await period.save();
            organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();
            token = await Token.createToken(user);

            const allGroupsUser = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    resources: new Map([[
                        PermissionsResourceType.Groups,
                        new Map([[
                            '', ResourcePermissions.create({
                                level: PermissionLevel.Full,
                            }),
                        ]]),
                    ]]),
                }),
            }).create();
            allGroupsToken = await Token.createToken(allGroupsUser);
        });

        const patchOrganizationRegistrationPeriods = async ({ patch, organization, token }: { patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> | OrganizationRegistrationPeriodStruct[]; organization: Organization; token: Token }) => {
            const request = Request.buildJson('PATCH', `/v${Version}/organization/registration-periods`, organization.getApiHost(), patch);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            return await testServer.test(endpoint, request);
        };

        test('Moving group to a different period is possible', async () => {
            const group = await new GroupFactory({ organization }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            const result = await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            expect(result.body).toHaveLength(1);
            expect(result.body[0].groups).toHaveLength(1);
            expect(result.body[0].groups[0].id).toBe(group.id);
            expect(result.body[0].groups[0].periodId).toBe(otherPeriod.id);
        });

        test('Moving group to a different period is possible as non-full admin', async () => {
            const group = await new GroupFactory({ organization }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            const result = await patchOrganizationRegistrationPeriods({ patch: body, organization, token: allGroupsToken });

            expect(result.body).toHaveLength(1);
            expect(result.body[0].groups).toHaveLength(1);
            expect(result.body[0].groups[0].id).toBe(group.id);
            expect(result.body[0].groups[0].periodId).toBe(otherPeriod.id);
        });

        test('Move group to period of other organization should fail', async () => {
            const group = await new GroupFactory({ organization }).create();
            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const otherOrganization = await new OrganizationFactory({}).create();
            const otherPeriod = await new RegistrationPeriodFactory({ organization: otherOrganization }).create();
            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow('Cannot patch periodId to a different period then the one being patched');
        });

        test('Move group to other period than period being patched should fail', async () => {
            const group = await new GroupFactory({ organization }).create();
            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow('Cannot patch periodId to a different period then the one being patched');
        });

        test('Moving group TO locked period should fail as normal admin', async () => {
            const group = await new GroupFactory({ organization }).create();
            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ organization, locked: true }).create();
            const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token: allGroupsToken })).rejects.toThrow(STExpect.simpleError({
                code: 'locked_period',
                message: 'This period is locked',
            }));
        });

        test('Moving group FROM locked period should fail as normal admin', async () => {
            const initialPeriod = await new RegistrationPeriodFactory({ organization, locked: true }).create();
            await new OrganizationRegistrationPeriodFactory({ organization, period: initialPeriod }).create();
            const group = await new GroupFactory({ organization, period: initialPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token: allGroupsToken })).rejects.toThrow(STExpect.simpleError({
                code: 'permission_denied',
            }));
        });

        test('Moving group TO locked period should not fail as full admin', async () => {
            const group = await new GroupFactory({ organization }).create();
            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ organization, locked: true }).create();
            const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            const result = await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            expect(result.body).toHaveLength(1);
            expect(result.body[0].groups).toHaveLength(1);
            expect(result.body[0].groups[0].id).toBe(group.id);
            expect(result.body[0].groups[0].periodId).toBe(otherPeriod.id);
        });

        test('Moving group FROM locked period should not fail as full admin', async () => {
            const initialPeriod = await new RegistrationPeriodFactory({ organization, locked: true }).create();
            await new OrganizationRegistrationPeriodFactory({ organization, period: initialPeriod }).create();
            const group = await new GroupFactory({ organization, period: initialPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            const result = await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            expect(result.body).toHaveLength(1);
            expect(result.body[0].groups).toHaveLength(1);
            expect(result.body[0].groups[0].id).toBe(group.id);
            expect(result.body[0].groups[0].periodId).toBe(otherPeriod.id);
        });

        test('Move group to period if waiting list linked to other groups should fail', async () => {
            const waitingList = await new GroupFactory({ organization, type: GroupType.WaitingList }).create();
            const group = await new GroupFactory({ organization, waitingListId: waitingList.id }).create();
            // link other group to waiting list
            await new GroupFactory({ organization, waitingListId: waitingList.id }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow('Group has waiting list with other groups in the current period');
        });

        test('Move group with other type than Membership should fail', async () => {
            const group = await new GroupFactory({ organization, type: GroupType.EventRegistration }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(`Moving group with type ${GroupType.EventRegistration} to a different period is not supported`);
        });

        test('Move group to period if waiting list only linked to this group should also update waiting list period', async () => {
            const waitingList = await new GroupFactory({ organization, type: GroupType.WaitingList }).create();
            const group = await new GroupFactory({ organization, waitingListId: waitingList.id }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            const result = await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            expect(result.body).toHaveLength(1);
            expect(result.body[0].groups).toHaveLength(2);
            expect(result.body[0].groups).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: group.id, periodId: otherPeriod.id }), expect.objectContaining({ id: waitingList.id, periodId: otherPeriod.id })]),
            );
        });

        test('Move group to period should also update period of registrations in group', async () => {
            const group = await new GroupFactory({ organization }).create();
            const member = await new MemberFactory({ organization }).create();
            const registration = await new RegistrationFactory({ group, member }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            const updatedRegistration = await Registration.getByID(registration.id);

            expect(updatedRegistration!.periodId).toBe(otherPeriod.id);
        });
    });

    describe('Platform mode', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'platform');
        });

        beforeAll(async () => {
            period = await new RegistrationPeriodFactory({}).create();
            organization = await new OrganizationFactory({ period }).create();
            await period.save();
            organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();
            token = await Token.createToken(user);
        });

        const patchOrganizationRegistrationPeriods = async ({ patch, organization, token }: { patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> | OrganizationRegistrationPeriodStruct[]; organization: Organization; token: Token }) => {
            const request = Request.buildJson('PATCH', `/v${Version}/organization/registration-periods`, organization.getApiHost(), patch);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            return await testServer.test(endpoint, request);
        };

        test('Moving group to a different period is possible', async () => {
            const group = await new GroupFactory({ organization }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            const result = await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            expect(result.body).toHaveLength(1);
            expect(result.body[0].groups).toHaveLength(1);
            expect(result.body[0].groups[0].id).toBe(group.id);
            expect(result.body[0].groups[0].periodId).toBe(otherPeriod.id);
        });

        test('Move group to other period than period being patched should fail', async () => {
            const group = await new GroupFactory({ organization }).create();
            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow('Cannot patch periodId to a different period then the one being patched');
        });

        test('Moving group TO locked period should fail', async () => {
            const group = await new GroupFactory({ organization }).create();
            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ locked: true }).create();
            const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(STExpect.simpleError({
                code: 'locked_period',
                message: 'This period is locked',
            }));
        });

        test('Moving group FROM locked period should fail', async () => {
            const initialPeriod = await new RegistrationPeriodFactory({ locked: true }).create();
            await new OrganizationRegistrationPeriodFactory({ organization, period: initialPeriod }).create();
            const group = await new GroupFactory({ organization, period: initialPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;
            const otherPeriod = await new RegistrationPeriodFactory({ }).create();
            const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: organizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(STExpect.simpleError({
                code: 'locked_period',
                message: 'This period is locked',
            }));
        });

        test('Move group to period if waiting list linked to other groups should fail', async () => {
            const waitingList = await new GroupFactory({ organization, type: GroupType.WaitingList }).create();
            const group = await new GroupFactory({ organization, waitingListId: waitingList.id }).create();
            // link other group to waiting list
            await new GroupFactory({ organization, waitingListId: waitingList.id }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow('Group has waiting list with other groups in the current period');
        });

        test('Move group with other type than Membership should fail', async () => {
            const group = await new GroupFactory({ organization, type: GroupType.EventRegistration }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await expect(patchOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(`Moving group with type ${GroupType.EventRegistration} to a different period is not supported`);
        });

        test('Move group to period if waiting list only linked to this group should also update waiting list period', async () => {
            const waitingList = await new GroupFactory({ organization, type: GroupType.WaitingList }).create();
            const group = await new GroupFactory({ organization, waitingListId: waitingList.id }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            const result = await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            expect(result.body).toHaveLength(1);
            expect(result.body[0].groups).toHaveLength(2);
            expect(result.body[0].groups).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: group.id, periodId: otherPeriod.id }), expect.objectContaining({ id: waitingList.id, periodId: otherPeriod.id })]),
            );
        });

        test('Move group to period should also update period of registrations in group', async () => {
            const group = await new GroupFactory({ organization }).create();
            const member = await new MemberFactory({ organization }).create();
            const registration = await new RegistrationFactory({ group, member }).create();

            const otherPeriod = await new RegistrationPeriodFactory({ }).create();
            const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

            const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

            const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
            const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
            periodPatch.groups.addPatch(groupPatch);

            body.addPatch(periodPatch);

            await patchOrganizationRegistrationPeriods({ patch: body, organization, token });

            const updatedRegistration = await Registration.getByID(registration.id);

            expect(updatedRegistration!.periodId).toBe(otherPeriod.id);
        });
    });
});

describe('Endpoint.PatchOrganizationRegistrationPeriodsEndpoint.MoveCategoryToPeriod', () => {
    let organization: Organization;
    let token: Token;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        const period = await new RegistrationPeriodFactory({}).create();
        organization = await new OrganizationFactory({ period }).create();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        token = await Token.createToken(user);
    });

    const patchOrganizationRegistrationPeriods = async ({ patch }: { patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> }) => {
        const request = Request.buildJson('PATCH', `/v${Version}/organization/registration-periods`, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    /**
     * Creates an organization period with a single top-level category (under the root) holding the given groups.
     */
    const createPeriodWithCategory = async (groupIds: string[]) => {
        const period = await new RegistrationPeriodFactory({}).create();
        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Movable category' }),
            groupIds,
        });

        const root = organizationPeriod.settings.rootCategory!;
        root.categoryIds = [category.id];
        organizationPeriod.settings.categories = [root, category];
        await organizationPeriod.save();

        return { period, organizationPeriod, category };
    };

    /**
     * Builds the patch the frontend (useGroupCategoryActions.moveToOtherPeriod) sends:
     * the category and all its descendants are added to the destination, the groups are moved,
     * and the category is removed from its parent in the source period.
     */
    const buildMovePatch = ({ source, destination, categories, topCategoryId, groupIds, destinationPeriodId }: {
        source: OrganizationRegistrationPeriod;
        destination: OrganizationRegistrationPeriod;
        categories: GroupCategory[];
        topCategoryId: string;
        groupIds: string[];
        destinationPeriodId: string;
    }) => {
        const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

        const destinationSettings = OrganizationRegistrationPeriodSettings.patch({});
        for (const category of categories) {
            destinationSettings.categories.addPut(category);
        }
        const destinationParent = GroupCategory.patch({ id: destination.settings.rootCategoryId });
        destinationParent.categoryIds.addPut(topCategoryId);
        destinationSettings.categories.addPatch(destinationParent);

        const destinationPatch = OrganizationRegistrationPeriodStruct.patch({ id: destination.id, settings: destinationSettings });
        for (const groupId of groupIds) {
            destinationPatch.groups.addPatch(Group.patch({ id: groupId, periodId: destinationPeriodId }));
        }

        const sourceSettings = OrganizationRegistrationPeriodSettings.patch({});
        const sourceParent = GroupCategory.patch({ id: source.settings.rootCategoryId });
        sourceParent.categoryIds.addDelete(topCategoryId);
        sourceSettings.categories.addPatch(sourceParent);
        const sourcePatch = OrganizationRegistrationPeriodStruct.patch({ id: source.id, settings: sourceSettings });

        // Order is important: the destination patch moves the groups first, then the source is cleaned up
        body.addPatch(destinationPatch);
        body.addPatch(sourcePatch);

        return body;
    };

    test('Moving a category with a group to another period', async () => {
        const group = await new GroupFactory({ organization }).create();
        const member = await new MemberFactory({ organization }).create();
        const registration = await new RegistrationFactory({ group, member }).create();

        const { organizationPeriod: source, category } = await createPeriodWithCategory([group.id]);

        const destinationPeriod = await new RegistrationPeriodFactory({}).create();
        const destination = await new OrganizationRegistrationPeriodFactory({ organization, period: destinationPeriod }).create();

        const body = buildMovePatch({
            source,
            destination,
            categories: [category],
            topCategoryId: category.id,
            groupIds: [group.id],
            destinationPeriodId: destinationPeriod.id,
        });

        const result = await patchOrganizationRegistrationPeriods({ patch: body });

        const destinationResult = result.body.find(p => p.id === destination.id)!;
        const sourceResult = result.body.find(p => p.id === source.id)!;

        // Category and group are now in the destination period
        expect(destinationResult.settings.categories.find(c => c.id === category.id)).toBeDefined();
        expect(destinationResult.settings.rootCategory?.categoryIds).toContain(category.id);
        const movedGroup = destinationResult.groups.find(g => g.id === group.id);
        expect(movedGroup).toBeDefined();
        expect(movedGroup!.periodId).toBe(destinationPeriod.id);

        // Category and group are removed from the source period
        expect(sourceResult.settings.categories.find(c => c.id === category.id)).toBeUndefined();
        expect(sourceResult.settings.rootCategory?.categoryIds ?? []).not.toContain(category.id);
        expect(sourceResult.groups.find(g => g.id === group.id)).toBeUndefined();

        // The registration in the group is also moved to the destination period
        const updatedRegistration = await Registration.getByID(registration.id);
        expect(updatedRegistration!.periodId).toBe(destinationPeriod.id);
    });

    test('Moving a category also moves its nested subcategories', async () => {
        const period = await new RegistrationPeriodFactory({}).create();
        const source = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
        const group = await new GroupFactory({ organization, period }).create();

        // root -> parent -> child(group)
        const child = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Child' }),
            groupIds: [group.id],
        });
        const parent = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Parent' }),
            categoryIds: [child.id],
        });
        const root = source.settings.rootCategory!;
        root.categoryIds = [parent.id];
        source.settings.categories = [root, parent, child];
        await source.save();

        const destinationPeriod = await new RegistrationPeriodFactory({}).create();
        const destination = await new OrganizationRegistrationPeriodFactory({ organization, period: destinationPeriod }).create();

        const body = buildMovePatch({
            source,
            destination,
            categories: [parent, child],
            topCategoryId: parent.id,
            groupIds: [group.id],
            destinationPeriodId: destinationPeriod.id,
        });

        const result = await patchOrganizationRegistrationPeriods({ patch: body });

        const destinationResult = result.body.find(p => p.id === destination.id)!;
        const sourceResult = result.body.find(p => p.id === source.id)!;

        // The whole subtree is now in the destination period
        expect(destinationResult.settings.rootCategory?.categoryIds).toContain(parent.id);
        expect(destinationResult.settings.categories.find(c => c.id === parent.id)?.categoryIds).toContain(child.id);
        expect(destinationResult.settings.categories.find(c => c.id === child.id)?.groupIds).toContain(group.id);
        expect(destinationResult.groups.find(g => g.id === group.id)?.periodId).toBe(destinationPeriod.id);

        // Nothing is left behind in the source period
        expect(sourceResult.settings.categories.find(c => c.id === parent.id)).toBeUndefined();
        expect(sourceResult.settings.categories.find(c => c.id === child.id)).toBeUndefined();
        expect(sourceResult.groups.find(g => g.id === group.id)).toBeUndefined();
    });

    test('Moving towards a locked period is blocked', async () => {
        const period = await new RegistrationPeriodFactory({}).create();
        const source = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
        const group = await new GroupFactory({ organization, period }).create();

        // root -> parent -> child(group)
        const child = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Child' }),
            groupIds: [group.id],
        });
        const parent = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Parent' }),
            categoryIds: [child.id],
        });
        const root = source.settings.rootCategory!;
        root.categoryIds = [parent.id];
        source.settings.categories = [root, parent, child];
        await source.save();

        const destinationPeriod = await new RegistrationPeriodFactory({}).create();

        const destination = await new OrganizationRegistrationPeriodFactory({ organization, period: destinationPeriod }).create();

        const body = buildMovePatch({
            source,
            destination,
            categories: [parent, child],
            topCategoryId: parent.id,
            groupIds: [group.id],
            destinationPeriodId: destinationPeriod.id,
        });
        destinationPeriod.locked = true;
        await destinationPeriod.save();
        expect(group.periodId).toEqual(period.id);

        await expect(patchOrganizationRegistrationPeriods({ patch: body })).rejects.toThrow(STExpect.simpleError({
            code: 'locked_period',
        }));

        // Check nothing moved
        await group.refresh();
        await source.refresh();
        expect(group.periodId).toEqual(period.id);
        expect(source.settings.categories).toEqual([root, parent, child]);
    });
});
