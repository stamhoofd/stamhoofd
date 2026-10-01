import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import type { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';

import { Context } from '../../../helpers/Context.js';
import { NotificationService } from '../../../services/NotificationService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = UserNotification;

/**
 * Marks one notification of the authenticated user as read. The id is the id of the UserNotification.
 */
export class MarkNotificationReadEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/notifications/@id/read', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        await Context.authenticate();

        const recipient = await NotificationRecipient.getByID(request.params.id);
        if (!recipient || recipient.userId !== Context.impersonatedUserOrUser.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Notification not found',
                human: $t('Deze melding werd niet gevonden'),
                statusCode: 404,
            });
        }

        const notification = await Notification.getByID(recipient.notificationId) as Notification;
        const isFullyRead = recipient.readAt !== null && recipient.readCount === notification.groupResourceCount;
        const updated = isFullyRead ? recipient : await NotificationService.markAsRead(recipient);

        return new Response(
            updated.getStructure(notification),
        );
    }
}
