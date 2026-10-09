import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { MailchimpSyncPreview } from '@stamhoofd/structures/mailchimp/MailchimpSyncPreview.js';
import { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = MailchimpSyncRequest;
type ResponseBody = MailchimpSyncPreview;

/**
 * Counts what a synchronisation would send, based on Stamhoofd data only
 */
export class PreviewMailchimpSyncEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = MailchimpSyncRequest as Decoder<MailchimpSyncRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/mailchimp/syncs/preview', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await MailchimpService.authenticate();
        return new Response(await MailchimpService.preview(organization, request.body));
    }
}
