import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Readable } from 'node:stream';
import { Context } from '../../../helpers/Context.js';
import { FileCache } from '../../../helpers/FileCache.js';
import { Formatter } from '@stamhoofd/utility';
import { RateLimiter } from '@stamhoofd/models';

type Params = Record<never, never>;
class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    file: string;

    @field({ decoder: StringDecoder, optional: true })
    name?: string;
}

type Body = undefined;
type ResponseBody = Readable;

export const limiter = new RateLimiter({
    limits: [
        {
            // Max 200 per day
            limit: 200,
            duration: 60 * 1000 * 60 * 24,
        },
    ],
});

export class GetFileCache extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/file-cache', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope({ willAuthenticate: false });

        limiter.track(request.request.getIP(), 1);

        // Return readable stream
        const { stream, contentLength, extension } = await FileCache.read(request.query.file, 1);

        const response = new Response(stream);
        response.headers['Content-Type'] = 'application/octet-stream';

        if (request.query.name) {
            const slug = Formatter.fileSlug(request.query.name) + extension;
            response.headers['Content-Disposition'] = `attachment; filename="${slug}"`;
        }
        else {
            response.headers['Content-Disposition'] = `attachment; filename="bestand${extension}"`;
        }
        response.headers['Content-Length'] = contentLength.toString();

        return response;
    }
}
