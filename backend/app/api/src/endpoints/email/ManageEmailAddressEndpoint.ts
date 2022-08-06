import { AutoEncoder, BooleanDecoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailAddress } from '@stamhoofd/email';

type Params = Record<string, never>;
type Query = undefined;

class Body extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    token: string

    @field({ decoder: BooleanDecoder, optional: true })
    unsubscribedMarketing?: boolean

    @field({ decoder: BooleanDecoder, optional: true })
    unsubscribedAll?: boolean
}

type ResponseBody = undefined;

export class ManageEmailAddressEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email/manage", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const email = await EmailAddress.getByID(request.body.id)
        if (!email || email.token !== request.body.token || request.body.token.length < 10 || request.body.id.length < 10) {
            throw new SimpleError({
                code: "invalid_fields",
                message: "Invalid token or id",
                human: "Deze link is vervallen. Probeer het opnieuw in een recentere e-mail"
            })
        }

        email.unsubscribedAll = request.body.unsubscribedAll ?? email.unsubscribedAll
        email.unsubscribedMarketing = request.body.unsubscribedMarketing ?? email.unsubscribedMarketing

        await email.save()
        return new Response(undefined);
    }
}