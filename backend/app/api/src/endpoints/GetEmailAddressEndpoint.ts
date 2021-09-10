import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailAddress } from '@stamhoofd/email';
import { Organization } from '@stamhoofd/models';
import { EmailAddressSettings, OrganizationSimple } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    token: string
}

type ResponseBody = EmailAddressSettings;

export class ManageEmailAddressEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email/manage", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const email = await EmailAddress.getByID(request.query.id)
        if (!email || email.token !== request.query.token || request.query.token.length < 10 || request.query.id.length < 10) {
            throw new SimpleError({
                code: "invalid_fields",
                message: "Invalid token or id",
                human: "Deze link is vervallen. Probeer het opnieuw in een recentere e-mail"
            })
        }

        const organization = email.organizationId ? (await Organization.getByID(email.organizationId)) : undefined
        return new Response(EmailAddressSettings.create({
            ...email,
            organization: organization ? OrganizationSimple.create(organization) : null
        }));
    }
}