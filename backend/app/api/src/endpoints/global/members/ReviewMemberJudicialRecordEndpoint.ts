import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Member } from '@stamhoofd/models';
import type { MembersBlob } from '@stamhoofd/structures';
import { JudicialRecordReviewRequest } from '@stamhoofd/structures';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { JudicialRecordService } from '../../../services/judicial-record/JudicialRecordService.js';

type Params = { id: string };
type Query = undefined;
type Body = JudicialRecordReviewRequest;
type ResponseBody = MembersBlob;

/**
 * Recording a reviewer's decision on a member's delivered extract.
 *
 * Answers with the member rather than with the decision, because the status the rest of the application reads
 * is derived from the record together with the member's responsibilities and age - so a client that patched
 * only the outcome would have to work out the status it implies, which is exactly the duplication
 * `JudicialRecordStatus` exists to avoid.
 */
export class ReviewMemberJudicialRecordEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = JudicialRecordReviewRequest as Decoder<JudicialRecordReviewRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members/@id/judicial-record/review', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        const member = await Member.getWithRegistrations(request.params.id);

        if (!member || !Context.auth.canReviewJudicialRecord()) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        await JudicialRecordService.review({
            member,
            outcome: request.body.reviewStatus,
            comment: request.body.comment,
            reviewer: {
                id: user.id,
                name: user.name ?? user.email,
                email: user.email,
                organizationId: Context.auth.organization?.id ?? null,
            },
        });

        return new Response(await AuthenticatedStructures.membersBlob([member]));
    }
}
