import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { MailchimpSync } from '@stamhoofd/models/models/MailchimpSync.js';
import type { MailchimpSync as MailchimpSyncStruct } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = MailchimpSyncStruct[];

/**
 * The most recent synchronisations, newest first
 */
export class GetMailchimpSyncsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/mailchimp/syncs', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const { organization } = await MailchimpService.authenticate();
        const syncs = await MailchimpSync.select()
            .where('organizationId', organization?.id ?? null)
            .orderBy('createdAt', 'DESC')
            .limit(5)
            .fetch();

        return new Response(syncs.map(s => MailchimpService.getStructure(s)));
    }
}
