import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { MailchimpSync } from '@stamhoofd/models/models/MailchimpSync.js';
import type { MailchimpSync as MailchimpSyncStruct } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { Context } from '../../../../helpers/Context.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = MailchimpSyncStruct;

export class GetMailchimpSyncEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/mailchimp/syncs/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await MailchimpService.authenticate();
        const sync = await MailchimpSync.getByID(request.params.id);

        if (!sync || sync.organizationId !== (organization?.id ?? null)) {
            throw Context.auth.notFoundOrNoAccess();
        }

        return new Response(MailchimpService.getStructure(sync));
    }
}
