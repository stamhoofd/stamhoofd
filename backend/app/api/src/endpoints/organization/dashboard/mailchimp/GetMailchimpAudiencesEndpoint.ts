import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { MailchimpAudience } from '@stamhoofd/structures/mailchimp/MailchimpAudience.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = MailchimpAudience[];

export class GetMailchimpAudiencesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/mailchimp/audiences', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const { organization } = await MailchimpService.authenticate();
        return new Response(await MailchimpService.getAudiences(organization));
    }
}
