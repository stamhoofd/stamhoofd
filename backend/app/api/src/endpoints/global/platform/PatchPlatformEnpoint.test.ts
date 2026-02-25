import { Request } from '@simonbackx/simple-endpoints';
import { Organization, OrganizationFactory, Platform, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, PlatformConfig, Platform as PlatformStruct, Version } from '@stamhoofd/structures';

import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { PatchPlatformEndpoint } from './PatchPlatformEnpoint.js';

describe('Endpoint.PatchPlatform', () => {
    // Test endpoint
    const endpoint = new PatchPlatformEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    const patchPlatform = async ({ patch, organization, token }: { patch: AutoEncoderPatchType<PlatformStruct>; organization: Organization; token: Token }) => {
        const request = Request.buildJson('PATCH', `/v${Version}/platform`, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    describe('userMode organization', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'organization');
        });

        test('Should return platform with global period', async () => {
            const organization = await new OrganizationFactory({ }).create();

            const admin = await new UserFactory({
                organization,
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            admin.organizationId = null;
            await admin.save();

            const token = await Token.createToken(admin);

            const patch = PlatformStruct.patch({
                config: PlatformConfig.patch({
                    name: 'new name',
                }),
            });

            // make sure no platform exists
            await Platform.delete().where('id', '1');

            // create global registration period
            await new RegistrationPeriodFactory({
            }).create();

            const response = await patchPlatform({ patch, organization, token });
            const periodId = response.body.period.id;
            const period = await RegistrationPeriod.getByID(periodId);

            expect(period).toBeDefined();
            expect(period?.organizationId).toBeNull();
        });
    });
});
