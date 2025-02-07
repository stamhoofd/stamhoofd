import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Event, EventNotification } from '@stamhoofd/models';
import { EventNotificationStatus, EventNotification as EventNotificationStruct } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<EventNotificationStruct>;
type ResponseBody = EventNotificationStruct[];

export class PatchEventNotificationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EventNotificationStruct as Decoder<EventNotificationStruct>, EventNotificationStruct.patchType() as Decoder<AutoEncoderPatchType<EventNotificationStruct>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/event-notifications', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        if (organization) {
            if (!await Context.auth.hasSomeAccess(organization.id)) {
                throw Context.auth.error();
            }
        }
        else {
            if (!Context.auth.hasSomePlatformAccess()) {
                throw Context.auth.error();
            }
        }

        const notifications: EventNotification[] = [];

        for (const { put } of request.body.getPuts()) {
            const notification = new EventNotification();

            if (!organization) {
                // Organization context is required when creating new event notifications

                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Organization is required',
                    human: 'Je moet een organisatie selecteren',
                    field: 'organizationId',
                });
            }

            if (put.events.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'At least one event is required',
                    field: 'events',
                });
            }

            const validatedEvents: Event[] = [];

            for (const [index, event] of put.events.entries()) {
                const model = await Event.getByID(event.id);
                if (!model || model.organizationId !== organization.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid event',
                        human: 'Dit evenement bestaat niet of is niet van jouw organisatie',
                        field: 'events',
                    });
                }
                if (!await Context.auth.canAccessEvent(model)) {
                    throw Context.auth.error('Cannot access event');
                }
                validatedEvents.push(model);

                if (index === 0) {
                    notification.startDate = model.startDate;
                    notification.endDate = model.endDate;
                }
                else {
                    await this.validateEvent(notification, model);
                }
            }

            notification.organizationId = organization.id;
            notification.recordAnswers = put.recordAnswers;
            notification.createdBy = user.id;
            notification.status = EventNotificationStatus.Draft;

            // More + validation

            await notification.save();

            // Link events
            await EventNotification.events.link(notification, validatedEvents);

            notifications.push(notification);
        }

        const patchingNotifications = await EventNotification.getByIDs(...request.body.getPatches().map(p => p.id));

        for (const patch of request.body.getPatches()) {
            const notification = patchingNotifications.find(e => e.id === patch.id);

            if (!notification) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'EventNotification not found',
                    human: 'De melding werd niet gevonden',
                });
            }

            // todo: check if user has access to this notification
            const events = await EventNotification.events.load(notification);
            for (const event of events) {
                if (!await Context.auth.canAccessEvent(event)) {
                    throw Context.auth.error('Je hebt geen toegang tot deze melding');
                }
            }

            if (
                notification.status === EventNotificationStatus.Pending
                || notification.status === EventNotificationStatus.Accepted
                || (patch.status && patch.status !== EventNotificationStatus.Pending)
            ) {
                // Requires `OrganizationEventNotificationReviewer` access right for the organization
                if (!await Context.auth.canReviewEventNotification(notification)) {
                    throw Context.auth.error('Je hebt geen toegang om deze melding te bewerken');
                }
            }

            // Save answers
            notification.recordAnswers = patchObject(notification.recordAnswers, patch.recordAnswers);

            if (patch.status) {
                // todo: email notifications etc
            }

            await notification.save();
            notifications.push(notification);
        }

        const structures = await AuthenticatedStructures.eventNotifications(notifications);
        return new Response(
            structures,
        );
    }

    async validateEvent(notification: EventNotification, event: Event) {
        if (notification.startDate !== event.startDate) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid start date',
                human: 'De startdatum van de melding moet gelijk zijn aan de startdatum van het evenement',
                field: 'startDate',
            });
        }

        if (notification.endDate !== event.endDate) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid end date',
                human: 'De einddatum van de melding moet gelijk zijn aan de einddatum van het evenement',
                field: 'endDate',
            });
        }
    }
}
