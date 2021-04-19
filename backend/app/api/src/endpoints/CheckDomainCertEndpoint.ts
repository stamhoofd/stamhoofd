import { AutoEncoder, Decoder,field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';

import { Organization } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
type Params = {};

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    domain: string;
}

type Body = undefined
type ResponseBody = undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class CheckDomainCertEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/check-domain-cert", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // check if the domain ends on .stamhoofd.be
        if (!process.env.HOSTNAME_REGISTRATION) {
            throw new Error("Expected environment variable HOSTNAME_REGISTRATION")
        }
        if (request.query.domain.endsWith("." + process.env.HOSTNAME_REGISTRATION)) {
            const strippped = request.query.domain.substr(0, request.query.domain.length - ("." + process.env.HOSTNAME_REGISTRATION).length )
            if (strippped.includes(".")) {
                throw new SimpleError({
                    code: "invalid_domain",
                    message: "This domain format is not supported",
                    statusCode: 404
                })
            }

            // Search for the URI
            const organization = await Organization.getByURI(strippped)

            if (!organization) {
                throw new SimpleError({
                    code: "unknown_domain",
                    message: "Not known",
                    statusCode: 404
                })
            }
            return new Response(undefined);
        }

        if (request.query.domain.endsWith("." + process.env.HOSTNAME_WEBSHOP)) {
            const strippped = request.query.domain.substr(0, request.query.domain.length - ("." + process.env.HOSTNAME_WEBSHOP).length )
            if (strippped.includes(".")) {
                throw new SimpleError({
                    code: "invalid_domain",
                    message: "This domain format is not supported",
                    statusCode: 404
                })
            }

            // Search for the URI
            const organization = await Organization.getByURI(strippped)

            if (!organization) {
                throw new SimpleError({
                    code: "unknown_domain",
                    message: "Not known",
                    statusCode: 404
                })
            }
            return new Response(undefined);
        }

        // Check if we have an organization with a custom domain name
        const organization = await Organization.getByRegisterDomain(request.query.domain)

        if (organization) {
            return new Response(undefined);
        }

        const webshop = await Webshop.getByDomainOnly(request.query.domain)
        if (webshop) {
            return new Response(undefined);
        }

        throw new SimpleError({
            code: "unknown_domain",
            message: "Not known",
            statusCode: 404
        })
    }
}
