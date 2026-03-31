import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { CpuService } from '../../services/CpuService.js';
import { StartupHealthService } from '../../services/StartupHealthService.js';

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
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
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

        const errors = [...StartupHealthService.getErrors()];

        if (CpuService.getAverage(60) > 80) {
            errors.push('CPU usage is too high');
        }

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
