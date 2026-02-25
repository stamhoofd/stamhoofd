import { Event } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

export const EventLogger = new ModelLogger(Event, {
    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.EventAdded,
        updated: AuditLogType.EventEdited,
        deleted: AuditLogType.EventDeleted,
    }),

    createReplacements(model) {
        return new Map([
            ['e', AuditLogReplacement.create({
                id: model.id,
                value: model.name,
                type: AuditLogReplacementType.Event,
            })],
        ]);
    },

    postProcess(event, options, log) {
        // Replace groupId key by 'registrations'
        for (const item of log.patchList) {
            if (item.key.value === 'groupId') {
                item.key = AuditLogReplacement.key('registrations');
            }
        }
    },
});
