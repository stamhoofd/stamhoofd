import { EventNotification, Platform } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

const defaultGenerator = getDefaultGenerator<EventNotification>({
    created: AuditLogType.EventNotificationAdded,
    updated: AuditLogType.EventNotificationEdited,
    deleted: AuditLogType.EventNotificationDeleted,
});

export const EventNotificationLogger = new ModelLogger(EventNotification, {
    skipKeys: ['createdBy', 'submittedBy', 'submittedAt', 'acceptedRecordAnswers'],

    async optionsGenerator(event) {
        const result = await defaultGenerator(event);
        if (!result) {
            return;
        }

        const platform = await Platform.getSharedPrivateStruct();
        const type = platform.config.eventNotificationTypes.find(type => type.id === event.model.typeId);

        return {
            ...result,
            data: {
                title: type?.title || event.model.id,
            },
        };
    },

    createReplacements(model, { data }) {
        return new Map([
            ['n', AuditLogReplacement.create({
                id: model.id,
                value: data.title,
                type: AuditLogReplacementType.EventNotification,
            })],
        ]);
    },
});
