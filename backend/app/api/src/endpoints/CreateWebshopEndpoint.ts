import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { PermissionLevel, PrivateWebshop } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

type Params = { };
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
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.canCreateWebshops(token.user.organization.privateMeta.roles)) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                human: "Je kan geen webshops maken, vraag aan de hoofdbeheerders om jou toegang te geven.",
                statusCode: 403
            })
        }

        const errors = new SimpleErrors()

        const webshop = new Webshop()

        webshop.id = request.body.id
        webshop.meta = request.body.meta
        webshop.privateMeta = request.body.privateMeta
        webshop.products = request.body.products
        webshop.categories = request.body.categories
        webshop.organizationId = user.organizationId

        if (request.request.getVersion() < 134) {   
            // Also set the legacy url
            webshop.legacyUri = request.body.uri
        }
        webshop.uri = request.body.uri.length > 0 ? request.body.uri : Formatter.slug(webshop.meta.name)
        
        // Check if this uri is inique

        const original = webshop.uri
        const possibleSuffixes = [Formatter.slug(user.organization.uri), new Date().getFullYear().toString()]
        let tried = 0
        while (await Webshop.getByURI(webshop.uri) !== undefined) {
            console.log("Webshop already exists", webshop.uri)

            if (tried < possibleSuffixes.length) {
                webshop.uri = original + "-" + possibleSuffixes[tried]
            } else if (tried > 9) {
                webshop.uri = original + "-" + Math.floor(Math.random() * 100000)
            } else {
                webshop.uri = original + "-" + (tried - possibleSuffixes.length + 2)
            }
            
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


        if (request.body.domain !== undefined) {
            webshop.domain = request.body.domain
        }

        if (request.body.domainUri !== undefined) {
            webshop.domainUri = request.body.domainUri
        }

        // Verify if we have full access
        if (webshop.privateMeta.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
            throw new SimpleError({
                code: "missing_permissions",
                message: "You cannot create a webshop without having full permissions on the created webshop",
                human: "Als je een webshop aanmaakt moet je ervoor zorgen dat jezelf ook volledige toegang hebt. Geef jezelf toegang via algemaan > toegangsbeheer voor je de webshop aanmaakt."
            })
        }

        await webshop.save()
        
        errors.throwIfNotEmpty()
        return new Response(PrivateWebshop.create(webshop));
    }
}
