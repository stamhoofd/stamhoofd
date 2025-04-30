import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Token, Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PermissionLevel, PrivateWebshop, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { Context } from '../../../../helpers/Context';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<PrivateWebshop>;
type ResponseBody = PrivateWebshop;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PrivateWebshop.patchType() as Decoder<AutoEncoderPatchType<PrivateWebshop>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        // Halt all order placement and validation + pause stock updates
        return await QueueHandler.schedule('webshop-stock/' + request.params.id, async () => {
            const webshop = await Webshop.getByID(request.params.id);
            if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
                throw Context.auth.notFoundOrNoAccess();
            }

            // Do all updates
            if (request.body.meta) {
                request.body.meta.domainActive = undefined;
                webshop.meta.patchOrPut(request.body.meta);
            }

            if (request.body.privateMeta) {
                // Prevent editing internal fields
                (request.body.privateMeta as any).dnsRecords = undefined;
                webshop.privateMeta.patchOrPut(request.body.privateMeta);
            }

            if (request.body.products) {
                webshop.products = request.body.products.applyTo(webshop.products);
            }

            if (request.body.categories) {
                webshop.categories = request.body.categories.applyTo(webshop.categories);
            }

            if (request.body.domain !== undefined) {
                if (request.body.domain !== null) {
                    const cleaned = request.body.domain.toLowerCase().replace(/[^a-zA-Z0-9-.]/g, '');

                    if (cleaned !== webshop.domain) {
                        webshop.domain = cleaned;
                        webshop.meta.domainActive = false;
                        webshop.privateMeta.dnsRecords = WebshopPrivateMetaData.buildDNSRecords(cleaned);

                        // Check if this is a known domain
                        const knownWebshops = await Webshop.getByDomainOnly(cleaned);

                        if (knownWebshops.length > 0) {
                            const active = !!knownWebshops.find(k => k.meta.domainActive);

                            if (active) {
                                const sameOrg = knownWebshops.find(w => w.organizationId === organization.id);
                                const otherOrg = knownWebshops.find(w => w.organizationId !== organization.id);
                                if (otherOrg && !sameOrg) {
                                    throw new SimpleError({
                                        code: 'domain_already_used',
                                        message: 'This domain is already used by another organization',
                                        human: $t(`Deze domeinnaam is al in gebruik door een andere vereniging. Neem contact op met Stamhoofd als je denkt dat je toch toegang zou moeten krijgen.`),
                                        statusCode: 400,
                                    });
                                }

                                // Automatically update the dns records already.
                                // This domain was already used, so no risk of making DNS-caches dirty
                                console.log('Automatically updating dns records for', cleaned, 'during patch');
                                await webshop.updateDNSRecords();
                            }
                        }

                        if (cleaned.length < 4 || !cleaned.includes('.')) {
                            throw new SimpleError({
                                code: 'invalid_field',
                                message: 'Invalid domain',
                                human: $t(`Ongeldige domeinnaam`),
                                field: 'customUrl',
                            });
                        }
                    }
                }
                else {
                    webshop.domain = null;
                    webshop.privateMeta.dnsRecords = [];
                    webshop.meta.domainActive = false;
                }
            }

            if (request.body.domainUri !== undefined) {
                if (webshop.domain !== null) {
                    webshop.domainUri = request.body.domainUri ?? '';

                    if (webshop.domainUri !== Formatter.slug(webshop.domainUri)) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'domainUri contains invalid characters',
                            human: $t(`Een link mag geen spaties, hoofdletters of speciale tekens bevatten`),
                            field: 'customUrl',
                        });
                    }

                    // Check exists
                    const existing = await Webshop.getByDomain(webshop.domain, webshop.domainUri);
                    if (existing !== undefined) {
                        throw new SimpleError({
                            code: 'invalid_domain',
                            message: 'This domain is already in use',
                            human: $t(`Deze link is al in gebruik door een andere webshop:`) + ' ' + existing.meta.name + $t(`. Verwijder of pas daar de link eerst aan als je die wilt hergebruiken.`),
                        });
                    }
                }
                else {
                    webshop.domainUri = null;
                }
            }

            if (request.body.legacyUri !== undefined) {
                // Support editing the legacy uri (e.g. delete it, or for older clients)
                webshop.legacyUri = request.body.legacyUri;
            }

            if (request.body.uri !== undefined) {
                // Validate
                if (request.body.uri.length == 0) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Uri cannot be empty',
                        human: $t(`De link mag niet leeg zijn`),
                        field: 'uri',
                    });
                }

                if (request.body.uri !== Formatter.slug(request.body.uri)) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Uri contains invalid characters',
                        human: $t(`Een link mag geen spaties, hoofdletters of speciale tekens bevatten`),
                        field: 'uri',
                    });
                }

                webshop.uri = request.body.uri;
            }

            // Verify if we still have full access
            if (!await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
                throw new SimpleError({
                    code: 'missing_permissions',
                    message: 'You cannot restrict your own permissions',
                    human: $t(`Je kan je eigen volledige toegang tot deze webshop niet verwijderen (algemeen > toegangsbeheer). Vraag aan een hoofdbeheerder om jouw toegang te verwijderen.`),
                });
            }

            try {
                await webshop.save();
            }
            catch (e) {
                // Duplicate key probably
                if (e.code && e.code == 'ER_DUP_ENTRY') {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Uri already in use',
                        human: $t(`De link die je hebt gekozen is al in gebruik. Kies een andere.`),
                        field: 'uri',
                    });
                }
                throw e;
            }

            return new Response(PrivateWebshop.create(webshop));
        });
    }
}
