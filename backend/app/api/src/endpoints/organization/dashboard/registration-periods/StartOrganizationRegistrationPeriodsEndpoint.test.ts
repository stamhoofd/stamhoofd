import { Request } from '@node/endpoints';
import type { Organization, RegistrationPeriod, Token } from '@stamhoofd/models';
import { GroupFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { GroupCategory, GroupCategorySettings, Permissions, Version } from '@stamhoofd/structures';
import { SessionService } from '../../../../services/SessionService.js';

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

    test('Moving organization to period of other organization should fail', async () => {
        const { organizationRegistrationPeriod } = await createPeriodWithCategory([]);

        const otherOrganization = await new OrganizationFactory({}).create();
        const otherPeriod = await new RegistrationPeriodFactory({ organization: otherOrganization }).create();

        await expect(startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: otherPeriod.id,
        }, organization, token })).rejects.toThrow(STExpect.errorWithCode('invalid_period'));
    });

    test('Moving organization TO locked period should fail', async () => {
        const otherPeriod = await new RegistrationPeriodFactory({ organization, locked: true }).create();
        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

        await expect(startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: otherPeriod.id,
        }, organization, token })).rejects.toThrow(STExpect.errorWithCode('locked_period'));
    });

    test('Moving organization to non-exsistent period should fail', async () => {
        const { organizationRegistrationPeriod } = await createPeriodWithCategory([]);

        await expect(startOrganizationRegistrationPeriods({
            body: {
                fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
                toRegistrationPeriodId: '12345',
            },
            organization,
            token,
        })).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('Moving organization from non-existent OrganizationRegistrationPeriod should fail', async () => {
        const { newPeriod } = await createPeriodWithCategory([]);

        await expect(startOrganizationRegistrationPeriods({
            body: {
                fromOrganizationRegistrationPeriodId: '12345',
                toRegistrationPeriodId: newPeriod.id,
            },
            organization,
            token,
        })).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });
});

describe('Platform mode', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

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
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const newPeriod = await new RegistrationPeriodFactory({ organization, endDate: futureDate }).create();
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

    test('Moving organization TO locked period should fail', async () => {
        const otherPeriod = await new RegistrationPeriodFactory({ organization, locked: true }).create();
        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();

        await expect(startOrganizationRegistrationPeriods({ body: {
            fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
            toRegistrationPeriodId: otherPeriod.id,
        }, organization, token })).rejects.toThrow(STExpect.errorWithCode('locked_period'));
    });

    test('Moving organization to non-exsistent period should fail', async () => {
        const { organizationRegistrationPeriod } = await createPeriodWithCategory([]);

        await expect(startOrganizationRegistrationPeriods({
            body: {
                fromOrganizationRegistrationPeriodId: organizationRegistrationPeriod.id,
                toRegistrationPeriodId: '12345',
            },
            organization,
            token,
        })).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('Moving organization from non-existent OrganizationRegistrationPeriod should fail', async () => {
        const { newPeriod } = await createPeriodWithCategory([]);

        await expect(startOrganizationRegistrationPeriods({
            body: {
                fromOrganizationRegistrationPeriodId: '12345',
                toRegistrationPeriodId: newPeriod.id,
            },
            organization,
            token,
        })).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });
});
