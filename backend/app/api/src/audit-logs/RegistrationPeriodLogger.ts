import { RegistrationPeriod } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

export const RegistrationPeriodLogger = new ModelLogger(RegistrationPeriod, {
    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.RegistrationPeriodAdded,
        updated: AuditLogType.RegistrationPeriodEdited,
        deleted: AuditLogType.RegistrationPeriodDeleted,
    }),

    createReplacements(model) {
        return new Map([
            ['p', AuditLogReplacement.create({
                id: model.id,
                value: model.getStructure().nameShort,
                type: AuditLogReplacementType.RegistrationPeriod,
            })],
        ]);
    },
});
