import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { OrganizationFactory, Platform, RegistrationPeriod, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { MemberResponsibility, MemberResponsibilityRecordBase, PermissionRoleForResponsibility, Permissions, PlatformConfig, PlatformPrivateConfig, Platform as PlatformStruct, Version } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { SessionService } from '../../../services/SessionService.js';

import type { AutoEncoderPatchType } from '@common/encoding';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
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

    describe('responsibilityEmailDomains', () => {
        afterEach(async () => {
            // The platform row is shared by every test file
            const platform = await Platform.getForEditing();
            platform.config.responsibilityEmailDomains = [];
            await platform.save();
        });

        test('Full platform admins can set normalized domains', async () => {
            const organization = await new OrganizationFactory({ }).create();
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await SessionService.createSession(admin);

            const response = await patchPlatform({
                patch: PlatformStruct.patch({
                    config: PlatformConfig.patch({
                        responsibilityEmailDomains: [' @KSA.be', 'gent.ksa.be', 'ksa.be', ''] as any,
                    }),
                }),
                organization,
                token,
            });

            expect(response.body.config.responsibilityEmailDomains).toEqual(['ksa.be', 'gent.ksa.be']);
        });

        test('Admins cannot exclude their own email domain', async () => {
            const organization = await new OrganizationFactory({ }).create();

            const responsibility = MemberResponsibility.create({
                name: 'Koepelbeheerder',
                organizationBased: false,
                permissions: PermissionRoleForResponsibility.create({ level: PermissionLevel.Full }),
            });
            const platform = await Platform.getForEditing();
            platform.config.responsibilities.push(responsibility);
            await platform.save();

            try {
                // This admin only has full access through the responsibility
                const admin = await new UserFactory({
                    email: `admin.${uuidv4()}@ksa.be`,
                    globalPermissions: Permissions.create({
                        responsibilities: [
                            MemberResponsibilityRecordBase.create({
                                responsibilityId: responsibility.id,
                                memberId: uuidv4(),
                                startDate: new Date(0),
                                endDate: null,
                            }),
                        ],
                    }),
                }).create();
                const token = await SessionService.createSession(admin);

                await expect(patchPlatform({
                    patch: PlatformStruct.patch({
                        config: PlatformConfig.patch({
                            responsibilityEmailDomains: ['fos.be'] as any,
                        }),
                    }),
                    organization,
                    token,
                })).rejects.toThrow(STExpect.errorWithCode('locked_out'));
                expect((await Platform.getForEditing()).config.responsibilityEmailDomains).toEqual([]);

                const response = await patchPlatform({
                    patch: PlatformStruct.patch({
                        config: PlatformConfig.patch({
                            responsibilityEmailDomains: ['fos.be', 'ksa.be'] as any,
                        }),
                    }),
                    organization,
                    token,
                });
                expect(response.body.config.responsibilityEmailDomains).toEqual(['fos.be', 'ksa.be']);
            } finally {
                const platform = await Platform.getForEditing();
                platform.config.responsibilities = platform.config.responsibilities.filter(r => r.id !== responsibility.id);
                await platform.save();
            }
        });

        test('Invalid domains are rejected', async () => {
            const organization = await new OrganizationFactory({ }).create();
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await SessionService.createSession(admin);

            await expect(patchPlatform({
                patch: PlatformStruct.patch({
                    config: PlatformConfig.patch({
                        responsibilityEmailDomains: ['john@ksa.be'] as any,
                    }),
                }),
                organization,
                token,
            })).rejects.toThrow(/Invalid domain name/);

            // No wildcard support: subdomains need to be added one by one
            await expect(patchPlatform({
                patch: PlatformStruct.patch({
                    config: PlatformConfig.patch({
                        responsibilityEmailDomains: ['*.ksa.be'] as any,
                    }),
                }),
                organization,
                token,
            })).rejects.toThrow(/Invalid domain name/);
            expect((await Platform.getForEditing()).config.responsibilityEmailDomains).toEqual([]);
        });

        test('Platform admins without full access cannot change the domains', async () => {
            const organization = await new OrganizationFactory({ }).create();
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Write }),
            }).create();
            const token = await SessionService.createSession(admin);

            await expect(patchPlatform({
                patch: PlatformStruct.patch({
                    config: PlatformConfig.patch({
                        responsibilityEmailDomains: ['ksa.be'] as any,
                    }),
                }),
                organization,
                token,
            })).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            expect((await Platform.getForEditing()).config.responsibilityEmailDomains).toEqual([]);
        });
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
