import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { SQL } from '@stamhoofd/sql';
import { CountFilteredRequest, CountResponse } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { GetNotificationsEndpoint } from './GetNotificationsEndpoint.js';

type Params = Record<string, never>;
type Query = CountFilteredRequest;
type Body = undefined;
type ResponseBody = CountResponse;

/**
 * Number of unread, not dismissed notifications of the authenticated user.
 */
export class GetUnreadNotificationsCountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = CountFilteredRequest as Decoder<CountFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/notifications/unread-count', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        await Context.authenticate();

        const query = await GetNotificationsEndpoint.buildQuery(request.query);
        query
            .where(SQL.column(NotificationRecipient.table, 'readAt'), null)
            .where(SQL.column(NotificationRecipient.table, 'dismissedAt'), null);

        return new Response(
            CountResponse.create({
                count: await query.count(),
            }),
        );
    }
}
