import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, Platform, Webshop } from '@stamhoofd/models';
type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    domain: string;
}

type Body = undefined;
type ResponseBody = undefined;

export class CheckDomainCertEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    registrationDomains = [...new Set(Object.values(STAMHOOFD.domains.registration ?? {}))];

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/check-domain-cert', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // check if the domain ends on one of our localized registration domains
        for (const domain of this.registrationDomains) {
            if (request.query.domain.endsWith('.' + domain)) {
                const strippped = request.query.domain.substr(0, request.query.domain.length - ('.' + domain).length);
                if (strippped.includes('.')) {
                    throw new SimpleError({
                        code: 'invalid_domain',
                        message: 'This domain format is not supported',
                        statusCode: 404,
                    });
                }

                // Search for the URI
                const organization = await Organization.getByURI(strippped);

                if (organization) {
                    return new Response(undefined);
                }

                // A tenant serves its organizations from <tenant-uri>.<registrationDomain> too
                if (await Platform.getByURI(strippped)) {
                    return new Response(undefined);
                }

                throw new SimpleError({
                    code: 'unknown_domain',
                    message: 'Not known',
                    statusCode: 404,
                });
            }
        }

        if (STAMHOOFD.domains.legacyWebshop && request.query.domain.endsWith('.' + STAMHOOFD.domains.legacyWebshop)) {
            const strippped = request.query.domain.substr(0, request.query.domain.length - ('.' + STAMHOOFD.domains.legacyWebshop).length);
            if (strippped.includes('.')) {
                throw new SimpleError({
                    code: 'invalid_domain',
                    message: 'This domain format is not supported',
                    statusCode: 404,
                });
            }

            // Search for the URI
            const organization = await Organization.getByURI(strippped);

            if (!organization) {
                throw new SimpleError({
                    code: 'unknown_domain',
                    message: 'Not known',
                    statusCode: 404,
                });
            }
            return new Response(undefined);
        }

        // Check if we have an organization with a custom domain name
        const organization = await Organization.getByRegisterDomain(request.query.domain);

        if (organization) {
            return new Response(undefined);
        }

        const webshops = await Webshop.getByDomainOnly(request.query.domain);
        if (webshops.length > 0) {
            return new Response(undefined);
        }

        // A tenant with its own domain
        if (await Platform.getByDomain(request.query.domain)) {
            return new Response(undefined);
        }

        throw new SimpleError({
            code: 'unknown_domain',
            message: 'Not known',
            statusCode: 404,
        });
    }
}
