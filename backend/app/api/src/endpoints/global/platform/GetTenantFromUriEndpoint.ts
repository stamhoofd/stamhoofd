import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Platform } from '@stamhoofd/models';
import type { Platform as PlatformStruct } from '@stamhoofd/structures';

type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    uri: string;
}

type Body = undefined;
type ResponseBody = PlatformStruct;

/**
 * Resolves a tenant by its uri, for switching between tenants.
 *
 * Unauthenticated on purpose, like the domain lookup, so it answers with the public structure only.
 */
export class GetTenantFromUriEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/tenant-from-uri', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const tenant = await Platform.getByURI(request.query.uri);

        if (!tenant) {
            throw new SimpleError({
                code: 'unknown_uri',
                message: 'Not known',
                statusCode: 404,
            });
        }

        return new Response(await Platform.getStructForTenant(tenant.id));
    }
}
