import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { Group, GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, RegistrationPeriod as RegistrationPeriodStruct, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { PatchRegistrationPeriodsEndpoint } from './PatchRegistrationPeriodsEndpoint.js';

const endpoint = new PatchRegistrationPeriodsEndpoint();

describe('Endpoint.PatchRegistrationPeriodsEndpoint', () => {
    let organization: Organization;
    let token: Token;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        token = await SessionService.createSession(user);
    });

    const patchPeriods = async (body: PatchableArrayAutoEncoder<RegistrationPeriodStruct>) => {
        const request = Request.buildJson('PATCH', `/v${Version}/registration-periods`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const deletePeriods = async (...periods: RegistrationPeriod[]) => {
        const body = new PatchableArray() as PatchableArrayAutoEncoder<RegistrationPeriodStruct>;
        for (const period of periods) {
            body.addDelete(period.id);
        }
        return await patchPeriods(body);
    };

    const createPeriod = async () => await new RegistrationPeriodFactory({ organization }).create();

    test('Cannot delete a period with registrations', async () => {
        const emptyPeriod = await createPeriod();
        const period = await createPeriod();
        const group = await new GroupFactory({ organization, period }).create();
        const member = await new MemberFactory({ organization }).create();
        await new RegistrationFactory({ group, member }).create();

        const newPeriod = RegistrationPeriodStruct.create({ startDate: new Date(), endDate: new Date(Date.now() + 1000) });
        const body = new PatchableArray() as PatchableArrayAutoEncoder<RegistrationPeriodStruct>;
        body.addPut(newPeriod);
        body.addDelete(emptyPeriod.id);
        body.addDelete(period.id);

        await expect(patchPeriods(body)).rejects.toThrow(STExpect.simpleError({ code: 'period_has_registrations' }));

        expect(await RegistrationPeriod.getByID(newPeriod.id)).toBeUndefined();
        expect(await RegistrationPeriod.getByID(emptyPeriod.id)).toBeDefined();
        expect(await RegistrationPeriod.getByID(period.id)).toBeDefined();
        expect(await Group.getByID(group.id)).toBeDefined();
    });

    test('Can delete a period with only unconfirmed, deactivated or deleted-group registrations', async () => {
        const period = await createPeriod();
        const group = await new GroupFactory({ organization, period }).create();
        const cartRegistration = await new RegistrationFactory({ group, member: await new MemberFactory({ organization }).create() }).create();
        cartRegistration.registeredAt = null;
        await cartRegistration.save();
        await new RegistrationFactory({ group, member: await new MemberFactory({ organization }).create(), deactivatedAt: new Date() }).create();

        const deletedGroup = await new GroupFactory({ organization, period }).create();
        const member = await new MemberFactory({ organization }).create();
        await new RegistrationFactory({ group: deletedGroup, member }).create();
        deletedGroup.deletedAt = new Date();
        await deletedGroup.save();

        await deletePeriods(period);

        expect(await RegistrationPeriod.getByID(period.id)).toBeUndefined();
    });
});
