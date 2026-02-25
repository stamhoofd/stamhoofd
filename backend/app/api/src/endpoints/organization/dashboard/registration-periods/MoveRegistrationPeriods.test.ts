import { Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, MemberFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodFactory, Registration, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { Group, GroupType, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';
import { PatchOrganizationRegistrationPeriodsEndpoint } from './PatchOrganizationRegistrationPeriodsEndpoint.js';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';

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
