import { AutoEncoder, Decoder, EmailDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors';
import { Token as TokenStruct } from "@stamhoofd/structures"

import { Admin } from '../../models/Admin';
import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = undefined;
class Body extends AutoEncoder {
    @field({ decoder: EmailDecoder })
    email: string

    @field({ decoder: StringDecoder })
    password: string
}

type ResponseBody = TokenStruct;

/**
 * This endpoint is only available in development mode
 */
export class RegisterEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST" || STAMHOOFD.environment !== "development") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/oauth/register", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Double check security
        if (STAMHOOFD.environment !== "development") {
            throw new SimpleError({
                code: "not_supported",
                message: "Not supported"
            })
        }

        if (request.body.password.length < 16) {
            throw new SimpleError({
                code: "invalid_password",
                message: "Invalid password"
            })
        }

        const admin = await Admin.register(request.body.email, request.body.password)

        if (!admin) {
            throw new SimpleError({
                code: "email_in_use",
                message: "Account already exists"
            })
        }

        const token = await AdminToken.createToken(admin);
        const st = new TokenStruct(token);
        return new Response(st);
    }
}
