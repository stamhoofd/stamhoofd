import { AutoEncoder, Data, Decoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { EmailTemplate } from '@stamhoofd/models';
import { EmailTemplate as EmailTemplateStruct, EmailTemplateType } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';
import { StringNullableDecoder } from '../../../../decoders/StringNullableDecoder';
import { StringArrayDecoder } from '../../../../decoders/StringArrayDecoder';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: new StringNullableDecoder(StringDecoder), optional: true, nullable: true })
    webshopId: string|null = null

    @field({ decoder: new StringNullableDecoder(new StringArrayDecoder(StringDecoder)), optional: true, nullable: true})
    groupIds: string[]|null = null

    @field({ decoder: new StringNullableDecoder(new StringArrayDecoder(new EnumDecoder(EmailTemplateType))), optional: true, nullable: true})
    types: EmailTemplateType[]|null = null
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
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate()

        if (organization) {
            if (!await Context.auth.canReadEmailTemplates(organization.id)) {
                throw Context.auth.error()
            }  
        } else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error()
            } 
        }

        const types = (request.query.types ?? [...Object.values(EmailTemplateType)]).filter(type => {
            if (!organization) {
                return EmailTemplateStruct.allowPlatformLevel(type)
            }
            return EmailTemplateStruct.allowOrganizationLevel(type)
        })

        
        const templates = organization ? (await EmailTemplate.where({ organizationId: organization.id, webshopId: request.query.webshopId ?? null, groupId: request.query.groupIds ? {sign: 'IN', value: request.query.groupIds} : null, type: {sign: 'IN', value: types}})) : [];        
        const defaultTemplates = await EmailTemplate.where({ organizationId: null, type: {sign: 'IN', value: types} });
        return new Response([...templates, ...defaultTemplates].map(template => EmailTemplateStruct.create(template)))
    }
}
