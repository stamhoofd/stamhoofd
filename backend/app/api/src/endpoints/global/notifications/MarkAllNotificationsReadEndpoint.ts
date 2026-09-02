import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { CountResponse } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { NotificationService } from '../../../services/NotificationService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = CountResponse;

/**
 * Marks every unread notification of the authenticated user as read. Returns how many were marked.
 */
export class MarkAllNotificationsReadEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/notifications/mark-all-read', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        await Context.authenticate();

        const count = await NotificationService.markAllAsRead(Context.impersonatedUserOrUser);

        return new Response(
            CountResponse.create({ count }),
        );
    }
}
