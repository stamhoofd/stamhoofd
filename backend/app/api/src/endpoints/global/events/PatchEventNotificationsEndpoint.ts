import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Event, EventNotification, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { EmailTemplateType, EventNotificationStatus, EventNotification as EventNotificationStruct, PermissionLevel, RecordCategory } from '@stamhoofd/structures';

import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { EventNotificationService } from '../../../services/EventNotificationService.js';

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
            if (put.events.length === 0) {
                // Required for authentication
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'At least one event is required',
                    field: 'events',
                });
            }

            const notification = new EventNotification();
            notification.organizationId = put.organization.id;
            notification.typeId = put.typeId;
            const type = await this.validateType(notification);

            const validatedEvents: Event[] = [];

            for (const [index, event] of put.events.entries()) {
                const model = await Event.getByID(event.id);
                if (!model || model.organizationId !== notification.organizationId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Invalid event',
                        human: $t(`4275fbbe-9921-454e-852c-9c53a9803f1f`),
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
                    const period = await RegistrationPeriod.getByDate(model.startDate, organization?.id ?? null);

                    if (!period) {
                        throw new SimpleError({
                            code: 'invalid_period',
                            message: 'No period found for this start date',
                            human: Context.i18n.$t('5959a6a9-064a-413c-871f-c74a145ed569'),
                            field: 'startDate',
                        });
                    }

                    if (period.locked) {
                        throw new SimpleError({
                            code: 'invalid_period',
                            message: 'Period is locked',
                            human: Context.i18n.$t('97616151-90c3-4644-8854-e228c4f355f5'),
                            field: 'startDate',
                        });
                    }

                    notification.periodId = period.id;
                }
                else {
                    await this.validateEventDate(notification, model);
                }
            }

            notification.recordAnswers = put.recordAnswers;
            await EventNotificationService.cleanAnswers(notification);
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
                    human: Context.i18n.$t('a0c39573-d44e-4ac0-aaeb-f9062fa1b3ce'),
                });
            }

            let requiredPermissionLevel = PermissionLevel.Write;

            if (
                notification.status === EventNotificationStatus.Pending
                || notification.status === EventNotificationStatus.Accepted
                || (patch.status && (patch.status !== EventNotificationStatus.Pending || (notification.status !== EventNotificationStatus.Draft && notification.status !== EventNotificationStatus.Rejected && notification.status !== EventNotificationStatus.PartiallyAccepted)))
                || patch.feedbackText !== undefined
            ) {
                requiredPermissionLevel = PermissionLevel.Full;
            }

            if (!await Context.auth.canAccessEventNotification(notification, requiredPermissionLevel)) {
                // Requires `OrganizationEventNotificationReviewer` access right for the organization
                if (notification.status === EventNotificationStatus.Pending) {
                    throw Context.auth.error(Context.i18n.$t('c5dcd14a-868e-4eba-a5dd-409932e44ce9'));
                }
                if (notification.status === EventNotificationStatus.Accepted) {
                    throw Context.auth.error(Context.i18n.$t('289e2f29-cdc9-4f44-92de-d7188d6563d7'));
                }
                throw Context.auth.error(Context.i18n.$t('b47ce42b-ac72-451e-b871-deb07d93b5fa'));
            }

            const period = await RegistrationPeriod.getByID(notification.periodId);
            if (!period) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Period not found',
                    human: Context.i18n.$t('16a3b696-f8da-4b2b-94b7-49c85ee1c38c'),
                });
            }

            if (period.locked) {
                throw new SimpleError({
                    code: 'invalid_period',
                    message: 'Period is locked',
                    human: Context.i18n.$t('43cc054d-cf2f-432b-9259-e7764dc929e3'),
                });
            }

            // Save answers
            notification.recordAnswers = patchObject(notification.recordAnswers, patch.recordAnswers);
            if (patch.recordAnswers?.size) {
                await EventNotificationService.cleanAnswers(notification);
            }
            notification.feedbackText = patchObject(notification.feedbackText, patch.feedbackText);

            if (patch.status && patch.status !== notification.status) {
                if (patch.status !== EventNotificationStatus.Rejected && patch.status !== EventNotificationStatus.Draft) {
                    // Only allowed if complete
                    await this.validateAnswers(notification);
                }
                const previousStatus = notification.status;
                notification.status = patch.status; // checks already happened
                if (patch.status === EventNotificationStatus.Pending) {
                    notification.submittedBy = user.id;
                    notification.submittedAt = new Date();
                }

                if (patch.status === EventNotificationStatus.Pending) {
                    await EventNotificationService.sendSubmitterEmail(EmailTemplateType.EventNotificationSubmittedCopy, notification);
                    await EventNotificationService.sendReviewerEmail(EmailTemplateType.EventNotificationSubmittedReviewer, notification);
                }

                if ((patch.status === EventNotificationStatus.Accepted) && previousStatus !== EventNotificationStatus.Accepted) {
                    // Make sure the accepted record answers stay in sync
                    notification.acceptedRecordAnswers = notification.recordAnswers;

                    await EventNotificationService.sendSubmitterEmail(EmailTemplateType.EventNotificationAccepted, notification);
                }

                if ((patch.status === EventNotificationStatus.PartiallyAccepted) && previousStatus !== EventNotificationStatus.Accepted && previousStatus !== EventNotificationStatus.PartiallyAccepted) {
                    // Make sure the accepted record answers stay in sync
                    notification.acceptedRecordAnswers = notification.recordAnswers;

                    await EventNotificationService.sendSubmitterEmail(EmailTemplateType.EventNotificationPartiallyAccepted, notification);
                }

                if (patch.status === EventNotificationStatus.Rejected) {
                    await EventNotificationService.sendSubmitterEmail(EmailTemplateType.EventNotificationRejected, notification);
                }
            }

            if (notification.status === EventNotificationStatus.Accepted) {
                // Make sure the accepted record answers stay in sync (only for full accepted, since these cannot be changed)
                notification.acceptedRecordAnswers = notification.recordAnswers;
            }

            await notification.save();
            notifications.push(notification);
        }

        for (const id of request.body.getDeletes()) {
            const notification = await EventNotification.getByID(id);

            if (!notification) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'EventNotification not found',
                    human: Context.i18n.$t('a0c39573-d44e-4ac0-aaeb-f9062fa1b3ce'),
                });
            }

            if (!await Context.auth.canAccessEventNotification(notification, PermissionLevel.Full)) {
                throw Context.auth.error();
            }

            await notification.delete();
        }

        const structures = await AuthenticatedStructures.eventNotifications(notifications);
        return new Response(
            structures,
        );
    }

    async validateType(notification: EventNotification) {
        const platform = await Platform.getSharedPrivateStruct();
        const type = platform.config.eventNotificationTypes.find(t => t.id === notification.typeId);

        if (!type) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid type',
                human: Context.i18n.$t('4d8be2b1-559a-4c16-a76f-67a8ba85de7f'),
                field: 'typeId',
            });
        }

        return type;
    }

    async validateAnswers(notification: EventNotification) {
        const type = await this.validateType(notification);
        const struct = await AuthenticatedStructures.eventNotification(notification);

        try {
            RecordCategory.validate(type.recordCategories, struct);
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace('recordAnswers');
            }
            throw e;
        }
    }

    async validateEventDate(notification: EventNotification, event: Event) {
        if (notification.startDate !== event.startDate) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid start date',
                human: Context.i18n.$t('daa3726b-9b63-4f36-b41b-8f25d1b89cf4'),
                field: 'startDate',
            });
        }

        if (notification.endDate !== event.endDate) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid end date',
                human: Context.i18n.$t('d326210d-ecc0-421c-b38b-d12ae0209420'),
                field: 'endDate',
            });
        }
    }
}
