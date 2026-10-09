import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { MailchimpSync } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = MailchimpSyncRequest;
type ResponseBody = MailchimpSync;

/**
 * Starts a synchronisation in the background. Poll GET /mailchimp/syncs/@id for the progress.
 */
export class StartMailchimpSyncEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = MailchimpSyncRequest as Decoder<MailchimpSyncRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/mailchimp/syncs', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization, user } = await MailchimpService.authenticate();
        const sync = await MailchimpService.start(organization, user, request.body);
        return new Response(MailchimpService.getStructure(sync));
    }
}
