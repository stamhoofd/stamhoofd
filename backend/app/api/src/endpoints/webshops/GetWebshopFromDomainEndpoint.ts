import { AutoEncoder, Decoder,field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { GetWebshopFromDomainResult, Webshop as WebshopStruct, WebshopPreview } from "@stamhoofd/structures";
import { GoogleTranslateHelper, Sorter } from "@stamhoofd/utility";
type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    domain: string;

    @field({ decoder: StringDecoder, nullable: true })
    uri: string | null;
}

type Body = undefined
type ResponseBody = GetWebshopFromDomainResult;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetWebshopFromDomainEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>
    webshopDomains = [
        ...new Set([
            ...Object.values(STAMHOOFD.domains.webshop), 
            ...Object.values(STAMHOOFD.domains.marketing)
        ])
    ]

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
        if (!STAMHOOFD.domains.webshop) {
            throw new Error("Expected environment variable HOSTNAME_WEBSHOP")
        }

        // Clean up google translate domains -> make sure we can translate register pages
        request.query.domain = GoogleTranslateHelper.getDomainFromTranslateDomain(request.query.domain)

        if (request.query.uri) {
            for (const domain of this.webshopDomains) {
                if (request.query.domain === domain) {
                    // Search webshop
                    const webshop = await Webshop.getByURI(request.query.uri)

                    if (!webshop) {
                        throw new SimpleError({
                            code: "unknown_webshop",
                            message: "No webshop registered with this name",
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

                    return new Response(GetWebshopFromDomainResult.create({
                        organization: await organization.getStructure(),
                        webshop: WebshopStruct.create(webshop)
                    }));
                }
            }
        }
        
        // If ends with the legacy webshop domain
        if (request.query.domain.endsWith("." + STAMHOOFD.domains.legacyWebshop)) {
            const strippped = request.query.domain.substr(0, request.query.domain.length - ("." + STAMHOOFD.domains.legacyWebshop).length )
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
            const webshop = await Webshop.getByLegacyURI(organization.id, request.query.uri ?? "")

            if (!webshop) {
                // Return organization, so we know the locale + can do some custom logic
                return new Response(GetWebshopFromDomainResult.create({
                    organization: await organization.getStructure(),
                    webshop: null,
                    webshops: []
                }));
            }

            return new Response(GetWebshopFromDomainResult.create({
                organization: await organization.getStructure(),
                webshop: WebshopStruct.create(webshop)
            }));
        }

        // Check if we have an organization with a custom domain name

        const webshop = await Webshop.getByDomain(request.query.domain, request.query.uri)

        if (!webshop) {
            // If uri is empty, check if we have multiple webshops with the same domain
            // Check organization
            if (!request.query.uri) {
                const webshops = await Webshop.getByDomainOnly(request.query.domain)
                const organizationId = Sorter.getMostOccuringElement(webshops.map(w => w.organizationId))

                if (webshops.length == 0 || !organizationId) {
                    throw new SimpleError({
                        code: "unknown_webshop",
                        message: "No webshop registered with this domain name",
                        statusCode: 404
                    })
                }

                const organization = await Organization.getByID(organizationId)

                if (!organization) {
                    throw new SimpleError({
                        code: "unknown_webshop",
                        message: "No webshop registered with this domain name",
                        statusCode: 404
                    })
                }

                // Return organization, and the known webshops on this domain
                return new Response(GetWebshopFromDomainResult.create({
                    organization: await organization.getStructure(),
                    webshop: null,
                    webshops: webshops.map(w => WebshopPreview.create(w)).filter(w => w.isClosed(0) === false).sort((a, b) => Sorter.byStringValue(a.meta.name, b.meta.name))
                }));
            }
            
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

        return new Response(GetWebshopFromDomainResult.create({
            organization: await organization.getStructure(),
            webshop: WebshopStruct.create(webshop)
        }));
    }
}
