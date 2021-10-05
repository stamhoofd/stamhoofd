import { AutoEncoder, Decoder,field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Organization as OrganizationStruct } from "@stamhoofd/structures";
import { GoogleTranslateHelper } from "@stamhoofd/utility";
type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    domain: string;
}

type Body = undefined
type ResponseBody = OrganizationStruct;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationFromDomainEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization-from-domain", {});

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

        // Clean up google translate domains -> make sure we can translate register pages
        request.query.domain = GoogleTranslateHelper.getDomainFromTranslateDomain(request.query.domain)

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
                    code: "unknown_organization",
                    message: "No organization registered with this domain name",
                    statusCode: 404
                })
            }
            return new Response(await organization.getStructure());
        }

        // Check if we have an organization with a custom domain name

        const organization = await Organization.getByRegisterDomain(request.query.domain)

        if (!organization) {
            throw new SimpleError({
                code: "unknown_organization",
                message: "No organization registered with this domain name",
                statusCode: 404
            })
        }
        return new Response(await organization.getStructure());
    }
}
