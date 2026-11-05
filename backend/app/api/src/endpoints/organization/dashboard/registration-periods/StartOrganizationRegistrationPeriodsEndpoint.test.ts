import { Request } from '@node/endpoints';
import type { Organization, RegistrationPeriod, Token } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { Group, GroupCategory, GroupCategorySettings, GroupType, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, Permissions, Version } from '@stamhoofd/structures';
import { SessionService } from '../../../../services/SessionService.js';

import type { PatchableArrayAutoEncoder } from '@common/encoding';
import { PatchableArray } from '@common/encoding';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { StartOrganizationRegistrationPeriodsEndpoint } from './StartOrganizationRegistrationPeriodsEndpoint.js';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';

const endpoint = new StartOrganizationRegistrationPeriodsEndpoint();

let currentPeriod: RegistrationPeriod;
let organization: Organization;
let token: Token;
let readToken: Token;

describe('Organization mode', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        currentPeriod = await new RegistrationPeriodFactory({ organization }).create();
        organization.periodId = currentPeriod.id;
        await organization.save();
    });

    beforeAll(async () => {
        currentPeriod = await new RegistrationPeriodFactory({}).create();
        organization = await new OrganizationFactory({ period: currentPeriod }).create();
        currentPeriod.organizationId = organization.id;
        await currentPeriod.save();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        token = await SessionService.createSession(user);

        const readUser = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        }).create();
        readToken = await SessionService.createSession(readUser);
    });

    const startOrganizationRegistrationPeriods = async ({ body, organization, token }: { body: {
        fromOrganizationRegistrationPeriodId?: string;
        toRegistrationPeriodId: string;
    }; organization: Organization; token: Token; }) => {
        const request = Request.buildJson('POST', `/v${Version}/organization/registration-periods/start`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const createPeriodWithCategory = async (groupIds: string[]) => {
        const newPeriod = await new RegistrationPeriodFactory({ organization }).create();
        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: currentPeriod }).create();

        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Movable category' }),
            groupIds,
        });

        const root = organizationRegistrationPeriod.settings.rootCategory!;
        root.categoryIds = [category.id];
        organizationRegistrationPeriod.settings.categories = [root, category];
        await organizationRegistrationPeriod.save();

        return { newPeriod, organizationRegistrationPeriod, category };
    };

    test('Moving organization to new period is possible', async () => {
        const { newPeriod, organizationRegistrationPeriod } = await createPeriodWithCategory([]);
        const result = await startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: newPeriod.id,
        }, organization, token });

        expect(result.body.period.id).toBe(newPeriod.id);
    });

    test('Moving organization to a different period moves its groups', async () => {
        const group = await new GroupFactory({ organization }).create();
        const { newPeriod, organizationRegistrationPeriod } = await createPeriodWithCategory([group.id]);

        const result = await startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: newPeriod.id,
        }, organization, token });

        expect(result.body.groups).toHaveLength(1);
        expect(result.body.groups[0].settings.name.toString()).toBe(group.settings.name.toString());
        expect(result.body.groups[0].periodId).toBe(newPeriod.id);
    });

    test('Moving organization to a different period is not possible as non-full admin', async () => {
        const { newPeriod, organizationRegistrationPeriod } = await createPeriodWithCategory([]);

        await expect(startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: newPeriod.id,
        }, organization, token: readToken })).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('Move organization to period of other organization should fail', async () => {
        const { organizationRegistrationPeriod } = await createPeriodWithCategory([]);

        const otherOrganization = await new OrganizationFactory({}).create();
        const otherPeriod = await new RegistrationPeriodFactory({ organization: otherOrganization }).create();

        await expect(startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: otherPeriod.id,
        }, organization, token })).rejects.toThrow(STExpect.errorWithMessage('Period has different organization id'));
    });

    test('Moving organization TO locked period should fail', async () => {
        const otherPeriod = await new RegistrationPeriodFactory({ organization, locked: true }).create();
        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

        await expect(startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: otherPeriod.id,
        }, organization, token })).rejects.toThrow(STExpect.errorWithCode('locked_period'));
    });

    /**
     * To test:
     * - period not found (code: not_found)
     * - Period has different organization id (invalid_period)
     * - Organization Period not found (not_found)
     */

    test('Move group to period if waiting list linked to other groups should fail', async () => {
        const waitingList = await new GroupFactory({ organization, type: GroupType.WaitingList }).create();
        const group = await new GroupFactory({ organization, waitingListId: waitingList.id }).create();
        // link other group to waiting list
        await new GroupFactory({ organization, waitingListId: waitingList.id }).create();

        const { newPeriod, organizationRegistrationPeriod } = await createPeriodWithCategory([group.id]);

        await expect(startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: newPeriod.id,
        }, organization, token })).rejects.toThrow('Group has waiting list with other groups in the current period');
    });

    test.todo('Move group with other type than Membership should fail', async () => {
        const group = await new GroupFactory({ organization, type: GroupType.EventRegistration }).create();

        const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
        const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

        const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

        const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
        const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
        periodPatch.groups.addPatch(groupPatch);

        body.addPatch(periodPatch);

        await expect(startOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(`Moving group with type ${GroupType.EventRegistration} to a different period is not supported`);
    });

    test.todo('Move group to period if waiting list only linked to this group should also update waiting list period', async () => {
        const waitingList = await new GroupFactory({ organization, type: GroupType.WaitingList }).create();
        const group = await new GroupFactory({ organization, waitingListId: waitingList.id }).create();

        const otherPeriod = await new RegistrationPeriodFactory({ organization }).create();
        const otherOrganizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

        const body = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>;

        const periodPatch = OrganizationRegistrationPeriodStruct.patch({ id: otherOrganizationRegistrationPeriod.id });
        const groupPatch = Group.patch({ id: group.id, periodId: otherPeriod.id });
        periodPatch.groups.addPatch(groupPatch);

        body.addPatch(periodPatch);

        const result = await startOrganizationRegistrationPeriods({ patch: body, organization, token });

        expect(result.body).toHaveLength(1);
        expect(result.body[0].groups).toHaveLength(2);
        expect(result.body[0].groups).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: group.id, periodId: otherPeriod.id }), expect.objectContaining({ id: waitingList.id, periodId: otherPeriod.id })]),
        );
    });

    test.todo('Move group to period should also update period of registrations in group', async () => {
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

        await startOrganizationRegistrationPeriods({ patch: body, organization, token });

        const updatedRegistration = await Registration.getByID(registration.id);

        expect(updatedRegistration!.periodId).toBe(otherPeriod.id);
    });
});

describe.todo('Platform mode', () => {
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
        token = await SessionService.createSession(user);
    });

    const startOrganizationRegistrationPeriods = async ({ body, organization, token }: { body: {
        fromOrganizationRegistrationPeriodId?: string;
        toRegistrationPeriodId: string;
    }; organization: Organization; token: Token; }) => {
        const request = Request.buildJson('POST', `/v${Version}/organization/registration-periods/start`, organization.getApiHost(), body);
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

        const result = await startOrganizationRegistrationPeriods({ patch: body, organization, token });

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

        await expect(startOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow('Cannot patch periodId to a different period then the one being patched');
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

        await expect(startOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(STExpect.simpleError({
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

        await expect(startOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(STExpect.simpleError({
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

        await expect(startOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow('Group has waiting list with other groups in the current period');
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

        await expect(startOrganizationRegistrationPeriods({ patch: body, organization, token })).rejects.toThrow(`Moving group with type ${GroupType.EventRegistration} to a different period is not supported`);
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

        const result = await startOrganizationRegistrationPeriods({ patch: body, organization, token });

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

        await startOrganizationRegistrationPeriods({ patch: body, organization, token });

        const updatedRegistration = await Registration.getByID(registration.id);

        expect(updatedRegistration!.periodId).toBe(otherPeriod.id);
    });
});
