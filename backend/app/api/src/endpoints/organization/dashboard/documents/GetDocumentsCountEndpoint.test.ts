import { Request } from '@node/endpoints';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { CountFilteredRequest, Permissions } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { GetDocumentsCountEndpoint } from './GetDocumentsCountEndpoint.js';

const baseUrl = '/organization/documents/count';
const endpoint = new GetDocumentsCountEndpoint();

describe('Endpoint.GetDocumentsCountEndpoint', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    const buildRequest = async (level: PermissionLevel) => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level }),
        }).create();
        const token = await SessionService.createSession(user);

        return Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new CountFilteredRequest({}),
            headers: { authorization: 'Bearer ' + token.accessToken },
        });
    };

    test('An admin with full access can count documents', async () => {
        const request = await buildRequest(PermissionLevel.Full);
        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(0);
    });

    test('An admin without permission to manage documents cannot count documents', async () => {
        const request = await buildRequest(PermissionLevel.Read);
        await expect(testServer.test(endpoint, request)).rejects.toThrow(
            STExpect.errorWithCode('permission_denied'),
        );
    });
});
