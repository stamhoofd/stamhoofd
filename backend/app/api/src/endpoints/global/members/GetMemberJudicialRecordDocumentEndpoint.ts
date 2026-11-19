import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Member } from '@stamhoofd/models';
import { Context } from '../../../helpers/Context.js';
import { JudicialRecordFileStore } from '../../../services/judicial-record/JudicialRecordFileStore.js';
import { JudicialRecordService } from '../../../services/judicial-record/JudicialRecordService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = Buffer;

/**
 * The stored extract, for a reviewer to look at.
 *
 * The bytes travel through here instead of through a signed url to the bucket, which is how every other file we
 * store is read. A signed url is a bearer token for someone's judicial record extract: it lives on in history,
 * logs and referrers, and no authorisation decision can take it back while it is valid. Going through the api
 * keeps the session the only way in, and the document is in the reviewer's browser either way.
 */
export class GetMemberJudicialRecordDocumentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members/@id/judicial-record/document', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        const member = await Member.getByIdWithUsers(request.params.id);

        if (!member || !Context.auth.canReviewJudicialRecord()) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        const record = await JudicialRecordService.getCurrentRecord(member.id);
        const reference = record.file?.reference ?? null;

        if (reference === null) {
            throw new SimpleError({
                code: 'judicial_record_document_removed',
                message: 'The document of this judicial record is no longer stored',
                human: $t('Dit uittreksel is niet meer beschikbaar.'),
                statusCode: 404,
            });
        }

        const response = new Response(Buffer.from(await JudicialRecordFileStore.read(reference)));

        // The pdf is drawn by the viewer in the dashboard, which reads the bytes. Nothing of this document is
        // ever rendered on the api origin, whatever it turns out to hold.
        response.headers['content-type'] = 'application/octet-stream';
        response.headers['content-disposition'] = 'attachment; filename="uittreksel.pdf"';
        response.headers['x-content-type-options'] = 'nosniff';
        response.headers['cache-control'] = 'no-store';

        return response;
    }
}
