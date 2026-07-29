import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { scheduleFileSync } from '../helpers/file-sync.js';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    key?: string;
}

type ResponseBody = string;

export class SyncFilesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/sync-files', {});
        return params ? [true, params as Params] : [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (!STAMHOOFD.HEALTH_ACCESS_KEY || request.query.key !== STAMHOOFD.HEALTH_ACCESS_KEY) {
            throw new SimpleError({
                code: 'unauthorized',
                message: 'Unauthorized',
                statusCode: 401,
            });
        }

        scheduleFileSync().catch(console.error);

        const response = new Response('Scheduled file sync');
        response.status = 201;
        return response;
    }
}
