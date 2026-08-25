import { S3Client } from '@aws-sdk/client-s3';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { MemberFactory, OrganizationFactory, RegistrationFactory, UserFactory } from '@stamhoofd/models';
import type { Permissions } from '@stamhoofd/structures';
import { File, PermissionLevel, Permissions as PermissionsStruct } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { FileSignService } from '../../../services/FileSignService.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetSignedFileUrlEndpoint } from './GetSignedFileUrlEndpoint.js';

describe('Endpoint.GetSignedFileUrl', () => {
    const endpoint = new GetSignedFileUrlEndpoint();
    let originalClient: S3Client;

    beforeEach(() => {
        TestUtils.setEnvironment('SPACES_BUCKET', 'test-bucket');
        TestUtils.setEnvironment('SPACES_ENDPOINT', 'test.digitaloceanspaces.com');

        originalClient = FileSignService.s3;
        FileSignService.s3 = new S3Client({
            forcePathStyle: false,
            endpoint: 'https://test.digitaloceanspaces.com',
            credentials: {
                accessKeyId: 'test-key',
                secretAccessKey: 'test-secret',
            },
            region: 'eu-west-1',
        });
    });

    afterEach(() => {
        FileSignService.s3 = originalClient;
    });

    const buildFile = (data: { path: string; isPrivate?: boolean }) => {
        return new File({
            id: '1c9ab9e6-1234-4c5e-9f1a-000000000000',
            server: 'https://test-bucket.test.digitaloceanspaces.com',
            path: data.path,
            name: 'report.pdf',
            size: 100,
            isPrivate: data.isPrivate ?? true,
            contentType: 'application/pdf',
        });
    };

    /**
     * A file that was uploaded by a user, like an answer of a member
     */
    const buildUserFile = async (user: User) => {
        const file = buildFile({ path: 'users/' + user.id + '/abc/report.pdf' });
        await file.sign();
        return file;
    };

    /**
     * A file that was uploaded without an account, like an answer of a webshop order
     */
    const buildAnonymousFile = async (organization: Organization) => {
        const file = buildFile({ path: 'anonymous/' + organization.id + '/abc/report.pdf' });
        await file.sign();
        return file;
    };

    const createUser = async (organization: Organization | null, permissions: Permissions | null = PermissionsStruct.create({ level: PermissionLevel.Full })) => {
        const user = await new UserFactory({ organization: organization ?? undefined, permissions }).create();
        const token = await SessionService.createSession(user);
        return { user, accessToken: token.accessToken };
    };

    /**
     * An administrator of the platform itself, which is not bound to an organization
     */
    const createPlatformAdmin = async () => {
        const user = await new UserFactory({ globalPermissions: PermissionsStruct.create({ level: PermissionLevel.Full }) }).create();
        const token = await SessionService.createSession(user);
        return { user, accessToken: token.accessToken };
    };

    const buildRequest = (file: File, options: { organization?: Organization; accessToken?: string }) => {
        const r = Request.buildJson('POST', '/v1/file-signed-url', options.organization?.getApiHost(), file);

        if (options.accessToken) {
            r.headers.authorization = 'Bearer ' + options.accessToken;
        }

        return r;
    };

    describe('Access', () => {
        test('It refuses an unauthenticated caller', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user } = await createUser(organization);

            await expect(testServer.test(endpoint, buildRequest(await buildUserFile(user), { organization }))).rejects.toThrow(/authorization header/i);
        });

        test('It refuses a user without permissions for the organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user, accessToken } = await createUser(organization, null);

            await expect(testServer.test(endpoint, buildRequest(await buildUserFile(user), { organization, accessToken }))).rejects.toThrow(/do not have permissions/i);
        });

        test('It refuses a user with empty permissions for the organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user, accessToken } = await createUser(organization, PermissionsStruct.create({}));

            await expect(testServer.test(endpoint, buildRequest(await buildUserFile(user), { organization, accessToken }))).rejects.toThrow(/do not have permissions/i);
        });
    });

    describe('Files that were uploaded by a user', () => {
        test('It returns a fresh signed url for the user that uploaded the file', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user, accessToken } = await createUser(organization);
            const file = await buildUserFile(user);

            const response = await testServer.test(endpoint, buildRequest(file, { organization, accessToken }));

            expect(response.body.signedUrl).toEqual(expect.any(String));

            const url = new URL(response.body.signedUrl!);
            expect(url.pathname).toBe('/' + file.path);
            expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();

            // The file itself is returned unchanged, so the client can keep using it
            expect(response.body.id).toBe(file.id);
            expect(response.body.path).toBe(file.path);
            expect(response.body.signature).toBe(file.signature);
        });

        test('It returns a signed url for an administrator of the organization of the uploader', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user } = await createUser(organization, null);
            const { accessToken } = await createUser(organization);

            const response = await testServer.test(endpoint, buildRequest(await buildUserFile(user), { organization, accessToken }));

            expect(response.body.signedUrl).toEqual(expect.any(String));
        });

        test('It refuses a file of a user of another organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const { user } = await createUser(otherOrganization, null);
            const { accessToken } = await createUser(organization);

            await expect(testServer.test(endpoint, buildRequest(await buildUserFile(user), { organization, accessToken }))).rejects.toThrow(/do not have permissions/i);
        });

        test('It refuses a file of another user for an administrator without full access', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user } = await createUser(organization, null);
            const { accessToken } = await createUser(organization, PermissionsStruct.create({ level: PermissionLevel.Read }));

            await expect(testServer.test(endpoint, buildRequest(await buildUserFile(user), { organization, accessToken }))).rejects.toThrow(/do not have permissions/i);
        });

        test('It refuses a file of a user that no longer exists', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { accessToken } = await createUser(organization);

            const file = buildFile({ path: 'users/1c9ab9e6-0000-4c5e-9f1a-000000000000/abc/report.pdf' });
            await file.sign();

            await expect(testServer.test(endpoint, buildRequest(file, { organization, accessToken }))).rejects.toThrow(/do not have permissions/i);
        });
    });

    describe('Files that were uploaded without a user', () => {
        test('It returns a signed url for an administrator of the organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { accessToken } = await createUser(organization);

            const response = await testServer.test(endpoint, buildRequest(await buildAnonymousFile(organization), { organization, accessToken }));

            expect(response.body.signedUrl).toEqual(expect.any(String));
        });

        test('It refuses a file of a webshop of another organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const { accessToken } = await createUser(organization);

            await expect(testServer.test(endpoint, buildRequest(await buildAnonymousFile(otherOrganization), { organization, accessToken }))).rejects.toThrow(/do not have permissions/i);
        });
    });

    describe('Files we refuse', () => {
        test('It refuses a file that is not stored under a user or an organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { accessToken } = await createUser(organization);

            const file = buildFile({ path: 'p/abc/report.pdf' });
            await file.sign();

            await expect(testServer.test(endpoint, buildRequest(file, { organization, accessToken }))).rejects.toThrow(/Not supported file/i);
        });

        test('It refuses a file without a signature', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user, accessToken } = await createUser(organization);

            const file = buildFile({ path: 'users/' + user.id + '/abc/report.pdf' });

            await expect(testServer.test(endpoint, buildRequest(file, { organization, accessToken }))).rejects.toThrow(/Missing signature for private file/);
        });

        test('It refuses a file with an invalid signature', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user, accessToken } = await createUser(organization);

            const file = buildFile({ path: 'users/' + user.id + '/abc/report.pdf' });
            file.signature = 'invalid';

            await expect(testServer.test(endpoint, buildRequest(file, { organization, accessToken }))).rejects.toThrow(/Invalid signature for file/);
        });

        test('It refuses a file that was changed after it was signed', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user, accessToken } = await createUser(organization);
            const file = await buildUserFile(user);

            // A user could try to read any file of the bucket by changing the path of a file they do have access to
            const tampered = new File({ ...file, path: 'users/' + user.id + '/def/secret.pdf' });

            await expect(testServer.test(endpoint, buildRequest(tampered, { organization, accessToken }))).rejects.toThrow(/Invalid signature for file/);
        });

        test('It refuses a public file', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { user, accessToken } = await createUser(organization);

            const file = buildFile({ path: 'p/users/' + user.id + '/abc/report.pdf', isPrivate: false });

            await expect(testServer.test(endpoint, buildRequest(file, { organization, accessToken }))).rejects.toThrow(/A public file does not need a signed url/);
        });
    });

    describe('Platform mode', () => {
        beforeEach(() => {
            TestUtils.setEnvironment('userMode', 'platform');
        });

        /**
         * A user that is not an administrator is not bound to an organization in platform mode
         */
        const createMemberUser = async (organization: Organization | null) => {
            const { user } = await createUser(null, null);
            const member = await new MemberFactory({ user }).create();

            if (organization) {
                await new RegistrationFactory({ member, organization }).create();
            }

            return user;
        };

        test('It returns a signed url for an administrator of the organization the uploader is registered at', async () => {
            const organization = await new OrganizationFactory({}).create();
            const uploader = await createMemberUser(organization);
            const { accessToken } = await createUser(organization);

            const response = await testServer.test(endpoint, buildRequest(await buildUserFile(uploader), { organization, accessToken }));

            expect(response.body.signedUrl).toEqual(expect.any(String));
        });

        test('It refuses a file of a user that is registered at another organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const uploader = await createMemberUser(otherOrganization);
            const { accessToken } = await createUser(organization);

            await expect(testServer.test(endpoint, buildRequest(await buildUserFile(uploader), { organization, accessToken }))).rejects.toThrow(/do not have permissions/i);
        });

        test('It returns a signed url for a platform administrator without an organization scope', async () => {
            const uploader = await createMemberUser(null);
            const { accessToken } = await createPlatformAdmin();

            const response = await testServer.test(endpoint, buildRequest(await buildUserFile(uploader), { accessToken }));

            expect(response.body.signedUrl).toEqual(expect.any(String));
        });

        test('It refuses a file of a webshop without an organization scope', async () => {
            const organization = await new OrganizationFactory({}).create();
            const { accessToken } = await createPlatformAdmin();

            await expect(testServer.test(endpoint, buildRequest(await buildAnonymousFile(organization), { accessToken }))).rejects.toThrow(/do not have permissions/i);
        });
    });

    test('It ignores a signed url provided by the client', async () => {
        const organization = await new OrganizationFactory({}).create();
        const { user, accessToken } = await createUser(organization);

        const file = await buildUserFile(user);
        file.signedUrl = 'https://test-bucket.test.digitaloceanspaces.com/' + file.path + '?evil=1';

        const response = await testServer.test(endpoint, buildRequest(file, { organization, accessToken }));

        expect(response.body.signedUrl).toEqual(expect.any(String));
        expect(response.body.signedUrl).not.toContain('evil');
    });
});
