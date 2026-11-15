import { Request } from '@node/endpoints';
import {
    Document,
    DocumentTemplateFactory,
    OrganizationFactory,
    UserFactory,
} from '@stamhoofd/models';
import { DocumentStatus, LimitedFilteredRequest, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { GetDocumentsEndpoint } from './GetDocumentsEndpoint.js';

const endpoint = new GetDocumentsEndpoint();

describe('Endpoint.GetDocumentsEndpoint', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('A key from a Belcotax message finds the document', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);
        const template = await new DocumentTemplateFactory({
            organizationId: organization.id,
            type: 'fiscal',
            year: 2026,
            groups: [],
        }).create();

        const documents: Document[] = [];
        for (let i = 0; i < 2; i++) {
            const document = new Document();
            document.organizationId = organization.id;
            document.templateId = template.id;
            document.status = DocumentStatus.Published;
            await document.save();
            documents.push(document);
        }
        const [document] = documents;

        for (const search of [
            `STA-2026-${document.id}`,
            `STA-2026-${document.id}-b`,
            ` STA-2026-${document.id}-c `,
            `sta-2026-${document.id.toUpperCase()}`,
            `2026-${document.id}`,
        ]) {
            const response = await testServer.test(
                endpoint,
                Request.get({
                    path: '/organization/documents',
                    host: organization.getApiHost(),
                    query: new LimitedFilteredRequest({ limit: 10, search }),
                    headers: { authorization: 'Bearer ' + token.accessToken },
                }),
            );

            expect(response.body.results.map((d) => d.id)).toEqual([document.id]);
        }
    });
});
