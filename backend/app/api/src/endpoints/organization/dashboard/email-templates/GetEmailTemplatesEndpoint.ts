import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailTemplate, Token } from '@stamhoofd/models';
import { EmailTemplate as EmailTemplateStruct, EmailTemplateType } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    webshopId?: string

    @field({ decoder: StringDecoder, optional: true })
    groupId?: string
}

type ResponseBody = EmailTemplateStruct[];

export class GetEmailTemplatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email-templates", {});

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

        const types = [
            EmailTemplateType.OrderConfirmationOnline, 
            EmailTemplateType.OrderConfirmationTransfer,
            EmailTemplateType.OrderConfirmationPOS,
            EmailTemplateType.OrderReceivedTransfer,
            EmailTemplateType.TicketsConfirmation,
            EmailTemplateType.TicketsConfirmationTransfer,
            EmailTemplateType.TicketsConfirmationPOS,
            EmailTemplateType.TicketsReceivedTransfer,
            EmailTemplateType.RegistrationConfirmation
        ]
        
        const templates = await EmailTemplate.where({ organizationId: user.organizationId, webshopId: request.query.webshopId ?? null, groupId: request.query.groupId ?? null, type: {sign: 'IN', value: types}});
        const defaultTemplates = await EmailTemplate.where({ organizationId: null, type: {sign: 'IN', value: types} });
        return new Response([...templates, ...defaultTemplates].map(template => EmailTemplateStruct.create(template)))
    }
}