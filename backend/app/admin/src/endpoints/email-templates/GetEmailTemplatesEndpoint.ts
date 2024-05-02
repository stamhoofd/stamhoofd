import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { EmailTemplate } from '@stamhoofd/models';
import { EmailTemplate as EmailTemplateStruct } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';


type Params = Record<string, never>;
type Body = undefined;
type Query = undefined;
type ResponseBody = EmailTemplateStruct[];

export class GetEmailTemplatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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
        await AdminToken.authenticate(request);
        
        const templates = await EmailTemplate.where({ organizationId: null });
        return new Response(templates.map(template => EmailTemplateStruct.create(template)))
    }
}