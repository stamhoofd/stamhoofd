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
    domain: string;
}

type Body = undefined;
type ResponseBody = PlatformStruct;

/**
 * Resolves the tenant a host belongs to.
 *
 * Unauthenticated on purpose: the frontend calls this before it has a session, to know which tenant
 * it is rendering. It therefore answers with the public structure only, never privateConfig.
 */
export class GetTenantFromDomainEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    registrationDomains = [...new Set(Object.values(STAMHOOFD.domains.registration ?? {}))];

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/tenant-from-domain', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const tenant = await this.findTenant(request.query.domain);

        if (!tenant) {
            throw new SimpleError({
                code: 'unknown_domain',
                message: 'Not known',
                statusCode: 404,
            });
        }

        return new Response(await Platform.getStructForTenant(tenant.id));
    }

    private async findTenant(host: string): Promise<Platform | undefined> {
        const byDomain = await Platform.getByDomain(host);
        if (byDomain) {
            return byDomain;
        }

        // A tenant without its own domain is served from <tenant-uri>.<registrationDomain>
        for (const domain of this.registrationDomains) {
            if (!host.endsWith('.' + domain)) {
                continue;
            }

            const uri = host.substring(0, host.length - ('.' + domain).length);
            if (uri.includes('.')) {
                return undefined;
            }

            return await Platform.getByURI(uri);
        }

        return undefined;
    }
}
