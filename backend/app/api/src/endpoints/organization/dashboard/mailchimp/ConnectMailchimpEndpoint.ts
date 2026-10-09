import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { MailchimpConnectRequest } from '@stamhoofd/structures/mailchimp/MailchimpConnectRequest.js';
import type { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = MailchimpConnectRequest;
type ResponseBody = MailchimpSettings;

/**
 * Validates and stores the API key of the organization, or of the platform when there is no organization
 */
export class ConnectMailchimpEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = MailchimpConnectRequest as Decoder<MailchimpConnectRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/mailchimp/connect', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await MailchimpService.authenticate();
        const settings = await MailchimpService.connect(organization, request.body.apiKey);
        return new Response(settings);
    }
}
