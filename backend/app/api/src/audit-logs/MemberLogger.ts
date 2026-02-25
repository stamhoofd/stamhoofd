import { Member } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

export const MemberLogger = new ModelLogger(Member, {
    // Skip repeated auto generated fields
    skipKeys: ['firstName', 'lastName', 'birthDay', 'memberNumber'],

    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.MemberAdded,
        updated: AuditLogType.MemberEdited,
        deleted: AuditLogType.MemberDeleted,
    }),

    createReplacements(model) {
        return new Map([
            ['m', AuditLogReplacement.create({
                id: model.id,
                value: model.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);
    },
});
