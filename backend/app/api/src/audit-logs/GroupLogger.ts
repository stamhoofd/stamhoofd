import { Group } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, GroupType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.GroupAdded,
    updated: AuditLogType.GroupEdited,
    deleted: AuditLogType.GroupDeleted,
});

export const GroupLogger = new ModelLogger(Group, {
    skipKeys: ['periodId', 'cycle', 'organizationId', 'stockReservations', 'settings.registeredMembers'],
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        const model = event.model;
        if (model.type === GroupType.WaitingList) {
            // Change event type
            switch (result.type) {
                case AuditLogType.GroupAdded:
                    result.type = AuditLogType.WaitingListAdded;
                    break;
                case AuditLogType.GroupEdited:
                    result.type = AuditLogType.WaitingListEdited;
                    break;
                case AuditLogType.GroupDeleted:
                    result.type = AuditLogType.WaitingListDeleted;
                    break;
            }
        }

        if (model.type === GroupType.EventRegistration) {
            // Change event type
            switch (result.type) {
                case AuditLogType.GroupAdded:
                    // do not log
                    return;
                case AuditLogType.GroupEdited:
                    result.type = AuditLogType.EventEdited;

                    if (model.settings.eventId) {
                        result.objectId = model.settings.eventId;
                    }
                    break;
                case AuditLogType.GroupDeleted:
                    // do not log
                    return;
            }
        }

        return result;
    },

    postProcess(event, _options, log) {
        if (log.type === AuditLogType.EventEdited) {
            // Prefix changes
            for (const item of log.patchList) {
                item.key = item.key.prepend(AuditLogReplacement.key('registrations'));
            }
        }
    },

    createReplacements: (model) => {
        if (model.type === GroupType.EventRegistration) {
            if (model.settings.eventId) {
                return new Map([
                    ['e', AuditLogReplacement.create({
                        id: model.settings.eventId,
                        value: model.settings.name.toString(),
                        type: AuditLogReplacementType.Event,
                    })],
                ]);
            }
            return new Map([
                ['e', AuditLogReplacement.create({
                    id: model.id,
                    value: model.settings.name.toString(),
                    type: AuditLogReplacementType.Group,
                })],
            ]);
        }

        return new Map([
            ['g', AuditLogReplacement.create({
                id: model.id,
                value: model.settings.name.toString(),
                type: AuditLogReplacementType.Group,
            })],
        ]);
    },
});
