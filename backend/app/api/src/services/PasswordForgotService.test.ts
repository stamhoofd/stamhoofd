import { I18n } from '@stamhoofd/backend-i18n';
import { Organization, OrganizationFactory, PasswordToken, User, UserFactory } from '@stamhoofd/models';
import { Address, OrganizationMetaData, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { PasswordForgotService } from './PasswordForgotService.js';

const i18n = new I18n(I18n.defaultLanguage, I18n.defaultCountry);

/**
 * An organization that is not saved in the database: enough to build an url with.
 */
function buildOrganization(id = 'organization-1') {
    const organization = new Organization();
    organization.id = id;
    organization.name = 'Test organization';
    organization.uri = 'test-organization';
    organization.meta = OrganizationMetaData.create({});
    organization.address = Address.create({
        street: 'Demostraat',
        number: '12',
        city: 'Gent',
        postalCode: '9000',
        country: Country.Belgium,
    });
    return organization;
}

function buildUser(organizationId: string | null) {
    const user = new User();
    user.id = 'user-1';
    user.organizationId = organizationId;
    user.email = 'user@example.com';
    return user;
}

function buildToken(user: User, token: string) {
    const passwordToken = new PasswordToken();
    passwordToken.token = token;
    passwordToken.userId = user.id;
    return passwordToken;
}

describe('PasswordForgotService', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    describe('getPasswordRecoveryUrl', () => {
        test('An administrator of the organization gets a dashboard url', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const url = new URL(await PasswordForgotService.getPasswordRecoveryUrl(admin, organization, i18n));

            expect(url.host).toBe(STAMHOOFD.domains.dashboard);
            expect(url.pathname).toMatch(/\/reset-password$/);
        });

        test('A user without permissions for the organization gets a registration url', async () => {
            const organization = await new OrganizationFactory({}).create();
            const member = await new UserFactory({ organization }).create();

            const url = new URL(await PasswordForgotService.getPasswordRecoveryUrl(member, organization, i18n));

            expect(url.host).not.toBe(STAMHOOFD.domains.dashboard);
            expect(url.host.split('.')[0]).toBe(organization.uri);
            expect(url.pathname).toMatch(/\/reset-password$/);
        });

        test('The url points to the reset-password page with a url encoded token', async () => {
            const organization = buildOrganization();
            const user = buildUser(organization.id);

            const url = await PasswordForgotService.getPasswordRecoveryUrlForToken(buildToken(user, 'a+b/c=d&e'), organization, i18n, user);

            expect(url).toMatch(/\/reset-password\?token=a%2Bb%2Fc%3Dd%26e$/);
            expect(new URL(url).searchParams.get('token')).toBe('a+b/c=d&e');
        });

        test('Throws when the user belongs to a different organization', async () => {
            const user = buildUser('a-different-organization');

            await expect(PasswordForgotService.getPasswordRecoveryUrlForToken(buildToken(user, 'my-token'), buildOrganization(), i18n, user))
                .rejects
                .toThrow('Unexpected mismatch in organization id for PasswordToken');
        });

        test('Allows a user without an organization in every scope', async () => {
            const user = buildUser(null);

            await expect(PasswordForgotService.getPasswordRecoveryUrlForToken(buildToken(user, 'my-token'), buildOrganization(), i18n, user))
                .toResolve();
        });
    });
});
