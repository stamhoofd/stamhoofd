import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import type { BelcotaxSubmitPreview } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';

import { BelcotaxConnectionService } from '../../../../services/belcotax/connection/BelcotaxConnectionService.js';
import { BelcotaxSubmissionService } from '../../../../services/belcotax/BelcotaxSubmissionService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = BelcotaxSubmitPreview;

/**
 * What "Doorsturen" would send for a template, with the documents the check holds back. Sends nothing.
 */
export class GetBelcotaxSubmitPreviewEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(
            request.url,
            '/organization/document-templates/@id/belcotax/preview',
            { id: String },
        );

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await BelcotaxConnectionService.authenticate();
        const template = await BelcotaxSubmissionService.getTemplate(request.params.id);
        return new Response(await BelcotaxSubmissionService.preview(template, organization));
    }
}
