import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import type { BelcotaxSubmission } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';

import { BelcotaxConnectionService } from '../../../../services/belcotax/connection/BelcotaxConnectionService.js';
import { BelcotaxSubmissionService } from '../../../../services/belcotax/BelcotaxSubmissionService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = BelcotaxSubmission;

/**
 * Sends the new, changed and deleted documents of a template to the Belcotax API. Returns once Belcotax received
 * the file or refused its format: the business rules are checked afterwards, poll
 * GET /organization/belcotax/submissions/@id for the result.
 */
export class SubmitBelcotaxEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(
            request.url,
            '/organization/document-templates/@id/belcotax/submit',
            { id: String },
        );

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization, user } = await BelcotaxConnectionService.authenticate();
        const template = await BelcotaxSubmissionService.getTemplate(request.params.id);
        const submission = await BelcotaxSubmissionService.submit(template, organization, user);
        return new Response(submission.getStructure());
    }
}
