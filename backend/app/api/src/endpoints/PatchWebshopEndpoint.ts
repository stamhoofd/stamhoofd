import { AutoEncoderPatchType,Decoder, PatchableArray } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PermissionLevel, PrivateWebshop, WebshopPrivateMetaData } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<PrivateWebshop>;
type ResponseBody = PrivateWebshop;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PrivateWebshop.patchType() as Decoder<AutoEncoderPatchType<PrivateWebshop>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        // Halt all order placement and validation + pause stock updates
        return await QueueHandler.schedule("webshop-stock/"+request.params.id, async () => {
            const webshop = await Webshop.getByID(request.params.id)
            if (!webshop || webshop.organizationId != user.organizationId) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Webshop not found",
                    human: "De webshop die je wilt aanpassen bestaat niet (meer)"
                })
            }

            if (webshop.privateMeta.permissions.getPermissionLevel(user.permissions!) !== PermissionLevel.Full) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "You do not have permissions for this endpoint",
                    statusCode: 403
                })
            }

            // Do all updates
            if (request.body.meta) {
                request.body.meta.domainActive = undefined
                webshop.meta.patchOrPut(request.body.meta)
            }

            if (request.body.privateMeta) {
                // Prevent editing internal fields
                (request.body.privateMeta as any).dnsRecords = undefined
                webshop.privateMeta.patchOrPut(request.body.privateMeta)
            }

            if (request.body.products) {
                webshop.products = request.body.products.applyTo(webshop.products)
            }

            if (request.body.categories) {
                webshop.categories = request.body.categories.applyTo(webshop.categories)
            }

            if (request.body.domain !== undefined) {
                if (request.body.domain !== null) {
                    const cleaned = request.body.domain.toLowerCase().replace(/[^a-zA-Z0-9-.]/g, '');

                    if (cleaned != webshop.domain) {
                        webshop.domain = cleaned
                        webshop.meta.domainActive = false
                        webshop.privateMeta.dnsRecords = WebshopPrivateMetaData.buildDNSRecords(cleaned)

                        // Check if this is a known domain
                        const known = await Webshop.getByDomainOnly(cleaned)

                        if (known && known?.organizationId === user.organizationId && known.meta.domainActive) {
                            // Automatically update the dns records already.
                            // This domain was already used, so no risk of making DNS-caches dirty
                            console.log("Automatically updating dns records for", cleaned, "during patch")
                            await webshop.updateDNSRecords()
                        }

                        if (cleaned.length < 4 || !cleaned.includes(".")) {
                            throw new SimpleError({
                                code: "invalid_field",
                                message: "Invalid domain",
                                human: "Ongeldige domeinnaam",
                                field: "customUrl"
                            })
                        }
                    }
                } else {
                    webshop.domain = null
                    webshop.privateMeta.dnsRecords = []
                    webshop.meta.domainActive = false
                }
            }

            if (request.body.domainUri !== undefined) {
                if (webshop.domain !== null) {
                    webshop.domainUri = request.body.domainUri ?? ""

                    if (webshop.domainUri != Formatter.slug(webshop.domainUri)) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "domainUri contains invalid characters",
                            human: "Een link mag geen spaties of speciale tekens bevatten",
                            field: "customUrl"
                        })
                    }
                } else {
                    webshop.domainUri = null
                }
            }

            if (request.body.uri !== undefined) {
                // Validate
                if (request.body.uri.length == 0) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Uri cannot be empty",
                        human: "De link mag niet leeg zijn",
                        field: "uri"
                    })
                }

                if (request.body.uri != Formatter.slug(request.body.uri)) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Uri contains invalid characters",
                        human: "Een link mag geen spaties of speciale tekens bevatten",
                        field: "uri"
                    })
                }

                webshop.uri = request.body.uri
            }

            // Verify if we still have full access
            if (webshop.privateMeta.permissions.getPermissionLevel(user.permissions!) !== PermissionLevel.Full) {
                throw new SimpleError({
                    code: "missing_permissions",
                    message: "You cannot restrict your own permissions",
                    human: "Je kan je eigen volledige toegang tot deze webshop niet verwijderen (algemeen > toegangsbeheer). Vraag aan een hoofdbeheerder om jouw toegang te verwijderen."
                })
            }

            try {
                await webshop.save()
            } catch (e) {
                // Duplicate key probably
                if (e.code && e.code == "ER_DUP_ENTRY") {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Uri already in use",
                        human: "De link die je hebt gekozen is al in gebruik. Kies een andere.",
                        field: "uri"
                    })
                }
                throw e;
            }
                
            return new Response(PrivateWebshop.create(webshop));
        })
    }
}
