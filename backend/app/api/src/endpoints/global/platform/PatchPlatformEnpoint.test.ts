import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { OrganizationFactory, Platform, RegistrationPeriod, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, PlatformConfig, PlatformPrivateConfig, Platform as PlatformStruct, Version } from '@stamhoofd/structures';
import { SessionService } from '../../../services/SessionService.js';

import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
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

    const setPlatformRequiresTwoFactor = async (requireTwoFactor: boolean) => {
        const platform = await Platform.getForEditing();
        platform.privateConfig.requireTwoFactor = requireTwoFactor;
        await platform.save();
    };

    test('Should save whether two-factor authentication is required for platform admins', async () => {
        const organization = await new OrganizationFactory({ }).create();

        const admin = await new UserFactory({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(admin);

        try {
            const response = await patchPlatform({
                patch: PlatformStruct.patch({
                    privateConfig: PlatformPrivateConfig.patch({
                        requireTwoFactor: true,
                    }),
                }),
                organization,
                token,
            });

            expect(response.body.privateConfig?.requireTwoFactor).toBe(true);
            expect((await Platform.getForEditing()).privateConfig.requireTwoFactor).toBe(true);
        } finally {
            // The platform row is shared by every test file
            await setPlatformRequiresTwoFactor(false);
        }
    });

    test('Should save the platform language', async () => {
        const organization = await new OrganizationFactory({ }).create();

        const admin = await new UserFactory({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(admin);

        expect((await Platform.getForEditing()).language).toBeNull();

        try {
            const response = await patchPlatform({
                patch: PlatformStruct.patch({
                    language: Language.French,
                }),
                organization,
                token,
            });

            expect(response.body.language).toBe(Language.French);
            expect((await Platform.getForEditing()).language).toBe(Language.French);

            // Null means the platform supports multiple languages
            const cleared = await patchPlatform({
                patch: PlatformStruct.patch({ language: null }),
                organization,
                token,
            });
            expect(cleared.body.language).toBeNull();
            expect((await Platform.getForEditing()).language).toBeNull();
        } finally {
            // The platform row is shared by every test file
            const platform = await Platform.getForEditing();
            platform.language = null;
            await platform.save();
        }
    });

    test('Should not allow organization admins to change the platform language', async () => {
        const organization = await new OrganizationFactory({ }).create();
        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(admin);

        await expect(patchPlatform({
            patch: PlatformStruct.patch({
                language: Language.French,
            }),
            organization,
            token,
        })).rejects.toThrow(/permission/i);
        expect((await Platform.getForEditing()).language).toBeNull();
    });

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

            const token = await SessionService.createSession(admin);

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
