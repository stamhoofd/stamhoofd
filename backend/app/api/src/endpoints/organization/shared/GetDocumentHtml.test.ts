import { Request } from '@node/endpoints';
import { verifyInternalSignature } from '@stamhoofd/backend-env';
import {
    Document,
    DocumentTemplateFactory,
    GroupFactory,
    MemberFactory,
    OrganizationFactory,
    UserFactory,
} from '@stamhoofd/models';
import { DocumentData, DocumentStatus, Permissions } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { DocumentRenderService } from '../../../services/DocumentRenderService.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetDocumentHtml } from './GetDocumentHtml.js';

/** Keeps session and permission checks real while stubbing document lookup and HTML generation. */
describe('GetDocumentHtml renderer grants', () => {
    afterEach(() => vi.restoreAllMocks());

    /**
     * An authorized organization administrator receives separate cache-read and
     * HTML-render grants, bound to the response's version and a one-minute expiry.
     * Revoking permissions with the session still active must reject another HTML
     * request before rendering; no-store prevents reuse of the grant response.
     */
    test('issues version-bound grants and rechecks revoked permissions', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);
        const document = new Document();
        document.id = 'document-grant-test';
        document.organizationId = organization.id;
        document.updatedAt = new Date(2000);
        vi.spyOn(Document, 'getByID').mockResolvedValue(document);
        vi.spyOn(DocumentRenderService, 'getRenderedHtml').mockResolvedValue(
            '<html>Document</html>',
        );
        // Reuse the same bearer session across both requests to exercise live permissions.
        const request = () =>
            Request.get({
                path: `/documents/${document.id}/html`,
                host: organization.getApiHost(),
                headers: { authorization: `Bearer ${token.accessToken}` },
            });
        const endpoint = new GetDocumentHtml();
        const response = await testServer.test(endpoint, request());
        const cacheId = String(response.headers['x-cache-id']);
        const timestamp = String(response.headers['x-cache-timestamp']);
        const expires = String(response.headers['x-cache-expires']);
        expect(Number(expires)).toBeGreaterThan(Date.now());
        expect(Number(expires)).toBeLessThanOrEqual(Date.now() + 60000);
        expect(
            verifyInternalSignature(
                String(response.headers['x-cache-read-signature']),
                'pdf-cache',
                cacheId,
                timestamp,
                expires,
            ),
        ).toBe(true);
        expect(
            verifyInternalSignature(
                String(response.headers['x-cache-signature']),
                'html-to-pdf',
                cacheId,
                timestamp,
                expires,
                response.body.toString(),
            ),
        ).toBe(true);
        expect(response.headers['cache-control']).toBe('no-store');

        user.permissions = null;
        await user.save();
        vi.mocked(DocumentRenderService.getRenderedHtml).mockClear();
        await expect(testServer.test(endpoint, request())).rejects.toThrow();
        expect(DocumentRenderService.getRenderedHtml).not.toHaveBeenCalled();
    });

    /**
     * A member who kept a document id from before the template was published may not keep fetching it:
     * the member portal hides those documents, so this check has to hide them too.
     */
    test('a member cannot fetch a document of a draft template', async () => {
        const organization = await new OrganizationFactory({}).create();
        const group = await new GroupFactory({ organization }).create();
        const user = await new UserFactory({ organization }).create();
        const member = await new MemberFactory({ organization, user }).create();
        const token = await SessionService.createSession(user);

        const template = await new DocumentTemplateFactory({
            groups: [group],
            status: DocumentStatus.Draft,
        }).create();

        const document = new Document();
        document.organizationId = organization.id;
        document.templateId = template.id;
        document.memberId = member.id;
        document.status = DocumentStatus.Published;
        document.data = DocumentData.create({ name: 'Test document' });
        await document.save();

        vi.spyOn(DocumentRenderService, 'getRenderedHtml').mockResolvedValue(
            '<html>Document</html>',
        );
        const request = () =>
            Request.get({
                path: `/documents/${document.id}/html`,
                host: organization.getApiHost(),
                headers: { authorization: `Bearer ${token.accessToken}` },
            });
        const endpoint = new GetDocumentHtml();

        await expect(testServer.test(endpoint, request())).rejects.toThrow();
        expect(DocumentRenderService.getRenderedHtml).not.toHaveBeenCalled();

        template.status = DocumentStatus.Published;
        await template.save();

        const response = await testServer.test(endpoint, request());
        expect(response.body.toString()).toBe('<html>Document</html>');
    });
});
