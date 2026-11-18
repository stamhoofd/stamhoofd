import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { BelcotaxSubmission } from '@stamhoofd/models';
import type { BelcotaxSubmission as BelcotaxSubmissionStruct } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';

import { Context } from '../../../../helpers/Context.js';
import { BelcotaxConnectionService } from '../../../../services/belcotax/connection/BelcotaxConnectionService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = BelcotaxSubmissionStruct;

export class GetBelcotaxSubmissionEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(
            request.url,
            '/organization/belcotax/submissions/@id',
            { id: String },
        );

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await BelcotaxConnectionService.authenticate();
        const submission = await BelcotaxSubmission.getByID(request.params.id);
        if (!submission || submission.organizationId !== organization.id) {
            throw Context.auth.notFoundOrNoAccess();
        }
        return new Response(submission.getStructure());
    }
}
