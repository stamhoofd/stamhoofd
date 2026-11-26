import { Request } from '@node/endpoints';
import {
    Document,
    DocumentTemplateFactory,
    GroupFactory,
    MemberFactory,
    OrganizationFactory,
    UserFactory,
} from '@stamhoofd/models';
import { DocumentData, DocumentStatus } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetUserDocumentsEndpoint } from './GetUserDocumentsEndpoint.js';

const endpoint = new GetUserDocumentsEndpoint();

describe('Endpoint.GetUserDocumentsEndpoint', () => {
    /**
     * Documents of a draft template are only for the admins to check. Incomplete documents are shown to
     * members so they can complete the data, but only once the template is published.
     */
    test.each(['platform', 'organization'] as const)(
        'Members only see documents of published templates (%s mode)',
        async (userMode) => {
            TestUtils.setEnvironment('userMode', userMode);

            const organization = await new OrganizationFactory({}).create();
            const group = await new GroupFactory({ organization }).create();
            const user = await new UserFactory({
                organization: userMode === 'organization' ? organization : undefined,
            }).create();
            const member = await new MemberFactory({ organization, user }).create();
            const token = await SessionService.createSession(user);

            const template = await new DocumentTemplateFactory({
                groups: [group],
                status: DocumentStatus.Draft,
            }).create();

            const documents: Document[] = [];
            for (const status of [DocumentStatus.Draft, DocumentStatus.MissingData]) {
                const document = new Document();
                document.organizationId = organization.id;
                document.templateId = template.id;
                document.memberId = member.id;
                document.status = status;
                document.data = DocumentData.create({ name: 'Test document' });
                await document.save();
                documents.push(document);
            }

            const getDocuments = async () => {
                const response = await testServer.test(
                    endpoint,
                    Request.get({
                        path: '/documents',
                        host: organization.getApiHost(),
                        headers: { authorization: 'Bearer ' + token.accessToken },
                    }),
                );
                return response.body.map((d) => d.id);
            };

            expect(await getDocuments()).toEqual([]);

            template.status = DocumentStatus.Published;
            await template.save();
            documents[0].status = DocumentStatus.Published;
            await documents[0].save();

            expect((await getDocuments()).sort()).toEqual(documents.map((d) => d.id).sort());
        },
    );
});
