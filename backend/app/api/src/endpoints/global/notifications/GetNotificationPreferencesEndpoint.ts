import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { NotificationPreference } from '@stamhoofd/structures/notifications/NotificationPreference.js';

import { Context } from '../../../helpers/Context.js';
import { NotificationService } from '../../../services/NotificationService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = NotificationPreference[];

/**
 * Stored notification preferences of the authenticated user. Missing preferences are enabled.
 */
export class GetNotificationPreferencesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/notifications/preferences', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        await Context.authenticate();

        const preferences = await NotificationService.getPreferences(Context.impersonatedUserOrUser);

        return new Response(
            preferences.map(p => p.getStructure()),
        );
    }
}
