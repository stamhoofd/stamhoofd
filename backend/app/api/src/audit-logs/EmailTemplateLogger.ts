import { EmailTemplate } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.EmailTemplateAdded,
    updated: AuditLogType.EmailTemplateEdited,
    deleted: AuditLogType.EmailTemplateDeleted,
});

export const EmailTemplateLogger = new ModelLogger(EmailTemplate, {
    skipKeys: ['json', 'text'], // html uses a special rendering method
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        // Manually inject helper methods to compare html

        return result;
    },

    createReplacements(model) {
        return new Map([
            ['e', AuditLogReplacement.create({
                id: model.id,
                value: model.type.includes('Saved') ? model.subject : model.type, // Translated in UI
                type: AuditLogReplacementType.EmailTemplate,
            })],
        ]);
    },
});
