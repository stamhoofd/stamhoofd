import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Member } from '@stamhoofd/models';
import { JudicialRecordReviewView } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context.js';
import { JudicialRecordService } from '../../../services/judicial-record/JudicialRecordService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = JudicialRecordReviewView;

/**
 * A member's current record as a reviewer sees it: what was decided, by whom, and what they wrote down.
 *
 * Apart from the member blob because of that last part. The blob is read by the member about themselves, and
 * the reviewer's name, email and comment are not theirs to read - a rejection is discussed with them, not
 * handed to them as a line of internal text.
 */
export class GetMemberJudicialRecordReviewEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
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
        await Context.authenticate();

        const member = await Member.getWithRegistrations(request.params.id);

        if (!member || !(await Context.auth.canReviewJudicialRecord(member))) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        const record = await JudicialRecordService.getCurrentRecord(member.id);

        return new Response(JudicialRecordReviewView.create({
            reviewDecision: record.reviewDecision,
            reviewDetails: record.reviewDetails,
            reviewedAt: record.reviewedAt,
            hasDocument: record.file?.reference !== null && record.file?.reference !== undefined,
            deliveredAt: record.createdAt,
        }));
    }
}
