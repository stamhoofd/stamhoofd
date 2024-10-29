import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { BackupHealth, getHealth } from '../helpers/backup';
import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    key?: string;
}

type ResponseBody = BackupHealth;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class HealthEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/health', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (STAMHOOFD.HEALTH_ACCESS_KEY && request.query.key !== STAMHOOFD.HEALTH_ACCESS_KEY) {
            throw new SimpleError({
                code: 'unauthorized',
                message: 'Unauthorized',
                statusCode: 401,
            });
        }

        const health = getHealth();
        const response = new Response(
            health,
        );

        if (health.status === 'error') {
            response.status = 503;
        }
        return response;
    }
}
