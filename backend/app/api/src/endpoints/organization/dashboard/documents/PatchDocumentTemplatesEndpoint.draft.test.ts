import { PatchableArray } from '@common/encoding';
import type { Endpoint } from '@node/endpoints';
import { Request } from '@node/endpoints';
import {
    BalanceItemFactory,
    Document,
    DocumentTemplateFactory,
    GroupFactory,
    MemberFactory,
    OrganizationFactory,
    RegistrationFactory,
    UserFactory,
} from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import {
    DocumentStatus,
    DocumentTemplatePrivate,
    Permissions,
    RecordSettings,
    RecordTextAnswer,
    RecordType,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { GetDocumentHtml } from '../../shared/GetDocumentHtml.js';
import { PatchDocumentTemplatesEndpoint } from './PatchDocumentTemplatesEndpoint.js';

const endpoint = new PatchDocumentTemplatesEndpoint();
type Body = typeof endpoint extends Endpoint<any, any, infer B, any> ? B : never;

describe('Endpoint.PatchDocumentTemplatesEndpoint.draft', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    /**
     * An organization without a company number saves an empty required template answer that the admin never sees.
     * The dashboard refuses to download incomplete certificates, so that made the drafts impossible to check.
     */
    test('An empty template answer does not make the certificates of a new draft incomplete', async () => {
        const organization = await new OrganizationFactory({}).create();
        const group = await new GroupFactory({ organization }).create();
        const member = await new MemberFactory({ organization }).create();
        const registration = await new RegistrationFactory({ member, group }).create();
        await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            amount: 1,
            unitPrice: 100_0000,
            pricePaid: 100_0000,
        }).create();

        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(admin);

        const template = await new DocumentTemplateFactory({
            groups: [group],
            type: 'fiscal',
            status: DocumentStatus.Draft,
        }).createWithoutSave();
        template.settings.fieldAnswers.set(
            'organization.companyNumber',
            RecordTextAnswer.create({
                settings: RecordSettings.create({
                    id: 'organization.companyNumber',
                    type: RecordType.Text,
                    required: true,
                }),
                value: '',
            }),
        );

        const arr: Body = new PatchableArray();
        arr.addPut(template.getPrivateStructure());
        const request = Request.buildJson(
            'PATCH',
            '/organization/document-templates',
            organization.getApiHost(),
            arr,
        );
        request.headers.authorization = 'Bearer ' + token.accessToken;
        const response = await testServer.test(endpoint, request);
        const created = response.body[0] as DocumentTemplatePrivate;

        // The certificates are built in the background
        await QueueHandler.awaitAll();

        const documents = await Document.where({ templateId: created.id });
        expect(documents).toHaveLength(1);
        expect(documents[0].status).toBe(DocumentStatus.Draft);

        const html = await testServer.test(
            new GetDocumentHtml(),
            Request.get({
                path: `/documents/${documents[0].id}/html`,
                host: organization.getApiHost(),
                headers: { authorization: 'Bearer ' + token.accessToken },
            }),
        );
        expect(html.status).toBe(200);
        expect(html.body.toString()).toContain(member.details.firstName);
    });
});
