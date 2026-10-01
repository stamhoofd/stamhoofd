import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { NotificationChannel, NotificationChannelHelper } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import { NotificationPreference } from '@stamhoofd/structures/notifications/NotificationPreference.js';
import { NotificationType, NotificationTypeHelper } from '@stamhoofd/structures/notifications/NotificationType.js';

import { Context } from '../../../helpers/Context.js';
import { NotificationService } from '../../../services/NotificationService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = NotificationPreference[];
type ResponseBody = NotificationPreference[];

/**
 * Sets the given preferences of the authenticated user and returns all stored preferences.
 */
export class PatchNotificationPreferencesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(NotificationPreference as Decoder<NotificationPreference>);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/notifications/preferences', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        await Context.authenticate();

        const maxLength = Object.values(NotificationType).length * Object.values(NotificationChannel).length;
        if (request.body.length > maxLength) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'body',
                message: 'Too many preferences, maximum is ' + maxLength,
            });
        }

        for (const preference of request.body) {
            if (!NotificationTypeHelper.isKnown(preference.type)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'type',
                    message: 'Unknown notification type ' + preference.type,
                });
            }

            if (!NotificationChannelHelper.isKnown(preference.channel)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'channel',
                    message: 'Unknown notification channel ' + preference.channel,
                });
            }
        }

        const user = Context.impersonatedUserOrUser;
        await NotificationService.setPreferences(user, request.body);
        const preferences = await NotificationService.getPreferences(user);

        return new Response(
            preferences.map(p => p.getStructure()),
        );
    }
}
