import { AutoEncoder, Decoder,field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { OrganizationWithWebshop, Webshop as WebshopStruct } from "@stamhoofd/structures";
type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    domain: string;

    @field({ decoder: StringDecoder, nullable: true })
    uri: string | null;
}

type Body = undefined
type ResponseBody = OrganizationWithWebshop;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationFromDomainEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop-from-domain", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // check if the domain ends on .stamhoofd.be
        if (!process.env.HOSTNAME_WEBSHOP) {
            throw new Error("Expected environment variable HOSTNAME_WEBSHOP")
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
                    code: "unknown_organization",
                    message: "No organization registered with this domain name",
                    statusCode: 404
                })
            }

            // Search webshop
            const webshop = await Webshop.getByURI(organization.id, request.query.uri ?? "")

            if (!webshop) {
                throw new SimpleError({
                    code: "unknown_webshop",
                    message: "No webshop registered with this name",
                    statusCode: 404
                })
            }

            return new Response(OrganizationWithWebshop.create({
                organization: await organization.getStructure(),
                webshop: WebshopStruct.create(webshop)
            }));
        }

        // Check if we have an organization with a custom domain name

        const webshop = await Webshop.getByDomain(request.query.domain, request.query.uri)

        if (!webshop) {
            throw new SimpleError({
                code: "unknown_webshop",
                message: "No webshop registered with this domain name",
                statusCode: 404
            })
        }

        const organization = await Organization.getByID(webshop.organizationId)

        if (!organization) {
                throw new SimpleError({
                    code: "unknown_organization",
                    message: "No organization registered with this domain name",
                    statusCode: 404
                })
            }

        return new Response(OrganizationWithWebshop.create({
            organization: await organization.getStructure(),
            webshop: WebshopStruct.create(webshop)
        }));
    }
}
