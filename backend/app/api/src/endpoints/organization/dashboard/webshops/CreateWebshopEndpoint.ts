import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Webshop } from '@stamhoofd/models';
import { PermissionLevel, PermissionsResourceType, PrivateWebshop, ResourcePermissions, Version, WebshopPrivateMetaData } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PrivateWebshop;
type ResponseBody = PrivateWebshop;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class CreateWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PrivateWebshop as Decoder<PrivateWebshop>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.canCreateWebshops(organization.id)) {
            throw Context.auth.error("Je kan geen webshops maken, vraag aan de hoofdbeheerders om jou toegang te geven.")
        }

        const errors = new SimpleErrors()

        const webshop = new Webshop()

        webshop.id = request.body.id
        webshop.meta = request.body.meta
        webshop.meta.domainActive = false;
        webshop.privateMeta = request.body.privateMeta
        webshop.products = request.body.products
        webshop.categories = request.body.categories
        webshop.organizationId = organization.id
        webshop.privateMeta.authorId = user.id;
        webshop.privateMeta.dnsRecords = [];
        let updateDNS = false

        // Check if we can decide the domain
        if (!request.body.domain && !request.body.domainUri) {
            const webshops = await Webshop.where({ 
                organizationId: organization.id, 
                domain: { 
                    value: null,
                    sign: "!="
                },
                domainUri: {
                    value: "",
                    sign: "!="
                }
            })

            const counters = new Map<string, number>()
            for (const webshop of webshops) {
                if (!webshop.domain || !webshop.meta.domainActive) {
                    continue
                }
                const count  = (counters.get(webshop.domain) ?? 0) + 1
                counters.set(webshop.domain, count)
            }

            if (counters.size > 0) {
                const maxDomain = [...counters.entries()].reduce((a, e ) => e[1] > a[1] ? e : a)[0]
                console.log("Choosing default domain for new webshop: ", maxDomain)

                webshop.domain = maxDomain
                webshop.domainUri = Formatter.slug(webshop.meta.name)
                webshop.privateMeta.dnsRecords = WebshopPrivateMetaData.buildDNSRecords(maxDomain)
                await this.checkDomainUri(webshop)
                updateDNS = true
            }

        } else {
            if (request.body.domain) {
                webshop.domain = request.body.domain

                if (request.body.domainUri) {
                    webshop.domainUri = Formatter.slug(request.body.domainUri)
                }

                webshop.privateMeta.dnsRecords = WebshopPrivateMetaData.buildDNSRecords(request.body.domain)
                await this.checkDomainUri(webshop)
                updateDNS = true
            }
        }

        webshop.uri = request.body.uri.length > 0 ? Formatter.slug(request.body.uri) : Formatter.slug(webshop.meta.name)

        // Check if this uri is inique
        let original = webshop.uri
        const possibleSuffixes = [new Date().getFullYear().toString(), Formatter.slug(organization.uri)]

        // Remove possible suffices from original
        for (const suffix of possibleSuffixes) {
            if (original.endsWith("-" + suffix)) {
                original = original.slice(0, -suffix.length - 1)
            }
        }

        let tried = 0
        while (webshop.uri.length > 100 || await Webshop.getByURI(webshop.uri) !== undefined) {

            console.log("Webshop already exists", webshop.uri)

            let suffix = ""
            if (tried < possibleSuffixes.length) {
                suffix = "-" + possibleSuffixes[tried]
            } else if (tried > 9) {
                 suffix = "-" + Math.floor(Math.random() * 100000)
            } else {
                 suffix = "-" + (tried - possibleSuffixes.length + 2)
            }
            
            webshop.uri = original.slice(0, 100 - suffix.length) + suffix;
            
            tried++
            if (tried > 15) {
                console.log("Failed to generate unique webshop uri")

                throw new SimpleError({
                    code: "failed_to_generate_unique_uri",
                    message: "Failed to generate unique uri",
                    human: "Er is een fout opgetreden bij het maken van de webshop, kies een andere naam voor jouw webshop",
                    statusCode: 500
                })
            }
        }

        if (!await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            // Create a temporary permission role for this user
            const organizationPermissions = user.permissions?.organizationPermissions?.get(organization.id)
            if (!organizationPermissions) {
                throw new Error('Unexpected missing permissions')
            }
            const resourcePermissions = ResourcePermissions.create({
                resourceName: webshop.meta.name,
                level: PermissionLevel.Full
            })
            const patch = resourcePermissions.createInsertPatch(PermissionsResourceType.Webshops, webshop.id, organizationPermissions)
            user.permissions!.organizationPermissions.set(organization.id, organizationPermissions.patch(patch))
            console.log('Automatically granted author full permissions to resource', 'webshop', webshop.id, 'user', user.id, 'patch', patch.encode({version: Version}))
            await user.save()
        }

        // Verify if we have full access
        if (!await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            throw new SimpleError({
                code: "missing_permissions",
                message: "You cannot create a webshop without having full permissions on the created webshop",
                human: "Als je een webshop aanmaakt moet je ervoor zorgen dat jezelf ook volledige toegang hebt."
            })
        }

        await webshop.save()

        if (updateDNS) {
            await webshop.updateDNSRecords()
        }
        
        errors.throwIfNotEmpty()
        return new Response(PrivateWebshop.create(webshop));
    }

    async checkDomainUri(webshop: Webshop) {
        if (!webshop.domain) {
            return
        }
        // Check if this uri is inique
        const original = webshop.domainUri ? webshop.domainUri + '-' : ''
        const possibleSuffixes = [new Date().getFullYear().toString()]
        let tried = 0
        while (await Webshop.getByDomain(webshop.domain, webshop.domainUri) !== undefined) {
            console.log("Webshop already exists", webshop.domainUri)

            if (tried < possibleSuffixes.length) {
                webshop.domainUri = original + possibleSuffixes[tried]
            } else if (tried > 9) {
                webshop.domainUri = original + Math.floor(Math.random() * 100000)
            } else {
                webshop.domainUri = original + (tried - possibleSuffixes.length + 2)
            }
            
            tried++

            if (tried > 15) {
                console.log("Failed to generate unique webshop domainUri")

                throw new SimpleError({
                    code: "failed_to_generate_unique_domainUri",
                    message: "Failed to generate unique domainUri",
                    human: "Er is een fout opgetreden bij het maken van de webshop, kies een andere naam voor jouw webshop",
                    statusCode: 500
                })
            }
        }
    }
}
