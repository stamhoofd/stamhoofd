import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { DocumentTemplate } from '@stamhoofd/models';
import type { JsonlExportResult } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { JsonlExportService } from '../../../../services/belcotax/JsonlExportService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = JsonlExportResult;

/**
 * Builds the JSON-lines file for Belcotax-on-web (income year 2026 and later), together with the documents that had to be left out.
 */
export class GetDocumentTemplateJsonlEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(
            request.url,
            '/organization/document-templates/@id/jsonl',
            { id: String },
        );

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!(await Context.auth.canManageDocuments(organization.id))) {
            throw Context.auth.error();
        }

        const template = await DocumentTemplate.getByID(request.params.id);
        if (!template || !(await Context.auth.canAccessDocumentTemplate(template))) {
            throw Context.auth.notFoundOrNoAccess($t('%EK'));
        }

        JsonlExportService.assertSupported(template);

        return new Response(await JsonlExportService.export(template, organization));
    }
}
