import { DocumentTemplate } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, {
    skipKeys: ['html'],
    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.DocumentTemplateAdded,
        updated: AuditLogType.DocumentTemplateEdited,
        deleted: AuditLogType.DocumentTemplateDeleted,
    }),

    createReplacements(model) {
        return new Map([
            ['d', AuditLogReplacement.create({
                id: model.id,
                value: model.settings.name,
                type: AuditLogReplacementType.DocumentTemplate,
            })],
        ]);
    },
});
