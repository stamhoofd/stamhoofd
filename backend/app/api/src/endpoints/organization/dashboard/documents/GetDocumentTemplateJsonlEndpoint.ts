import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { DocumentTemplate } from '@stamhoofd/models';
import type { JsonlExportResult } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { JsonlExportService } from '../../../../services/belcotax/JsonlExportService.js';
import { BelcotaxJsonlService } from '../../../../services/belcotax/BelcotaxJsonlService.js';

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

        if (
            template.privateSettings.templateDefinition.type !== 'fiscal' ||
            !BelcotaxJsonlService.isSupportedYear(template.year)
        ) {
            throw new SimpleError({
                code: 'jsonl_export_not_supported',
                message:
                    'The Belcotax export is only available for fiscal documents from income year 2026 onwards',
                human: $t(
                    'Dit bestand voor Belcotax is enkel beschikbaar voor fiscale attesten vanaf inkomstenjaar 2026.',
                ),
            });
        }

        if (template.updatesEnabled) {
            throw new SimpleError({
                code: 'updates_enabled',
                message: 'Disable automatic updates before exporting to Belcotax',
                human: $t('%1Kr'),
            });
        }

        return new Response(await JsonlExportService.export(template, organization));
    }
}
