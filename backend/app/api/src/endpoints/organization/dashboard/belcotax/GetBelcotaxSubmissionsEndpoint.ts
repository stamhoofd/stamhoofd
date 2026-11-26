import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { BelcotaxSubmission, DocumentTemplate } from '@stamhoofd/models';
import type { BelcotaxSubmission as BelcotaxSubmissionStruct } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';

import { Context } from '../../../../helpers/Context.js';
import { BelcotaxConnectionService } from '../../../../services/belcotax/connection/BelcotaxConnectionService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = BelcotaxSubmissionStruct[];

/**
 * The submissions of a template, newest first
 */
export class GetBelcotaxSubmissionsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(
            request.url,
            '/organization/document-templates/@id/belcotax/submissions',
            { id: String },
        );

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await BelcotaxConnectionService.authenticate();
        const template = await DocumentTemplate.getByID(request.params.id);
        if (
            !template ||
            !(await Context.auth.canAccessDocumentTemplate(template, PermissionLevel.Full))
        ) {
            throw Context.auth.notFoundOrNoAccess($t('%EK'));
        }

        const submissions = await BelcotaxSubmission.select()
            .where('templateId', template.id)
            .orderBy('createdAt', 'DESC')
            .limit(50)
            .fetch();
        return new Response(submissions.map((s) => s.getStructure()));
    }
}
