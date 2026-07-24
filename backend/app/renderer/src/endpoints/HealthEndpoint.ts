import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    key?: string;
}

export class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    status: 'ok' | 'error';

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    errors?: string[];
}

/**
 * Liveness/health endpoint for the renderer service. Guarded by an optional access key so it can be
 * polled by load balancers and monitoring without exposing anything sensitive. The endpoint is only
 * registered when a HEALTH_ACCESS_KEY is configured.
 */

export class HealthEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        if (!STAMHOOFD.HEALTH_ACCESS_KEY) {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/health', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (!STAMHOOFD.HEALTH_ACCESS_KEY) {
            throw new SimpleError({
                code: 'unauthorized',
                message: 'Unauthorized',
                statusCode: 401,
            });
        }

        if (STAMHOOFD.HEALTH_ACCESS_KEY && request.query.key !== STAMHOOFD.HEALTH_ACCESS_KEY) {
            throw new SimpleError({
                code: 'unauthorized',
                message: 'Unauthorized',
                statusCode: 401,
            });
        }

        // The renderer has no async health signals yet; reaching this point means the process is up
        // and serving requests. Renderer-specific checks can be pushed into `errors` in the future.
        const errors: string[] = [];

        const health = ResponseBody.create({
            status: errors.length > 0 ? 'error' : 'ok',
            errors: errors.length > 0 ? errors : undefined,
        });

        const response = new Response(
            health,
        );

        if (health.status === 'error') {
            response.status = 503;
        }
        return response;
    }
}
