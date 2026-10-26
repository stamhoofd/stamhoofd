import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { signInternal } from '@stamhoofd/backend-env';
import { Document, Organization } from '@stamhoofd/models';

import { Context } from '../../../helpers/Context.js';
import { DocumentRenderService } from '../../../services/DocumentRenderService.js';
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

    /**
     * Checks current document access and returns UTF-8 HTML with separate, one-minute
     * renderer grants for reading its exact cached version and rendering these bytes.
     * The response must not be stored: each new grant requires another access check.
     */
    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        const document = await Document.getByID(request.params.id);
        if (!document || !(await Context.auth.canAccessDocument(document))) {
            throw new SimpleError({
                code: 'not_found',
                message: $t('%EK'),
            });
        }

        const organization = await Organization.getByID(document.organizationId);

        if (!organization) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Organization not found',
            });
        }

        const html = await DocumentRenderService.getRenderedHtml(document, organization);
        if (!html) {
            throw new SimpleError({
                code: 'failed_generating',
                message: $t('%FV'),
            });
        }

        const response = new Response(Buffer.from(html, 'utf8'));
        response.headers['content-type'] = 'text/plain; charset=utf-8'; // avoid JS execution
        response.headers['content-length'] = Buffer.byteLength(html, 'utf8').toString();
        response.headers['x-cache-id'] = 'document-' + document.id;
        response.headers['x-cache-timestamp'] = document.updatedAt.getTime().toString();
        // Renderer grants are scoped to one version and expire after one minute.
        const expires = String(Date.now() + 60000);
        response.headers['cache-control'] = 'no-store';
        response.headers['x-cache-expires'] = expires;
        response.headers['x-cache-read-signature'] = signInternal('pdf-cache', 'document-' + document.id, document.updatedAt.getTime().toString(), expires);
        response.headers['x-cache-signature'] = signInternal('html-to-pdf', 'document-' + document.id, document.updatedAt.getTime().toString(), expires, html);
        return response;
    }
}
