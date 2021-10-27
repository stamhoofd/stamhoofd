import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import jwt from 'jsonwebtoken'

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    jwt: string
}

export class CreateNoltTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        if (!STAMHOOFD.NOLT_SSO_SECRET_KEY) {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/nolt/create-token", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);

        // Get user unrestriced
        const user = token.user

        // Check has admin permissions
        if (user.permissions === null) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Admin permissions required to sign in to Nolt",
                human: "Je moet ingelogd zijn als beheerder om toegang te krijgen tot het feedback systeem van Stamhoofd.",
                statusCode: 403
            })
        }

        // Create token
        const payload = {
            // The ID that you use in your app for this user
            id: user.id,
            // The user's email address that
            // Nolt should use for notifications
            email: user.email,
            // The display name for this user
            name: user.firstName+" "+user.lastName,

            // Optional: The URL to the user's avatar picture
            imageUrl: user.organization.meta.squareLogo?.getPublicPath() ?? user.organization.meta.horizontalLogo?.getPublicPath() ?? undefined
        }

        const str = jwt.sign(payload, STAMHOOFD.NOLT_SSO_SECRET_KEY, { algorithm: 'HS256' });
        return new Response(ResponseBody.create({ "jwt": str }));      
    
    }
}
