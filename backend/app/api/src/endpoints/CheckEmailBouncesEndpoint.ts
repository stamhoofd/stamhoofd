import { ArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailInformation } from '@stamhoofd/structures';

import { EmailAddress } from '../models/EmailAddress';
import { Token } from '../models/Token';

type Params = {};
type Query = undefined;
type Body = string[]
type ResponseBody = EmailInformation[];

export class CheckEmailBouncesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email/check-bounces", {});

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

        if (request.body.length > 1000) {
            throw new SimpleError({
                code: "too_many_recipients",
                message: "Too many recipients",
                human: "Je kan maar maximaal 1000 adressen tergelijk controleren.",
                field: "recipients"
            })
        }

        const emails = await EmailAddress.getByEmails(request.body, user.organizationId)
        return new Response(emails.map(e => EmailInformation.create(e)));
    }
}
