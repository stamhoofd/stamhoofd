import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { signInternal } from '@stamhoofd/backend-env';
import { Document, Organization } from '@stamhoofd/models';

import { Context } from '../../../helpers/Context.js';
type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = Buffer;

export class GetDocumentHtml extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/documents/@id/html', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        const document = await Document.getByID(request.params.id);
        if (!document || !(await Context.auth.canAccessDocument(document))) {
            throw new SimpleError({
                code: 'not_found',
                message: $t('a9860203-6a6d-4612-b4d4-7851e47d4dad'),
            });
        }

        const organization = await Organization.getByID(document.organizationId);

        if (!organization) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Organization not found',
            });
        }

        const html = await document.getRenderedHtml(organization);
        if (!html) {
            throw new SimpleError({
                code: 'failed_generating',
                message: $t('74ba486a-60b2-4d94-a6fd-159a3adfca8b'),
            });
        }

        const response = new Response(Buffer.from(html, 'utf8'));
        response.headers['content-type'] = 'text/plain; charset=utf-8'; // avoid JS execution
        response.headers['content-length'] = Buffer.byteLength(html, 'utf8').toString();
        response.headers['x-cache-id'] = 'document-' + document.id;
        response.headers['x-cache-timestamp'] = document.updatedAt.getTime().toString();
        response.headers['x-cache-signature'] = signInternal('document-' + document.id, document.updatedAt.getTime().toString(), html);
        return response;
    }
}
