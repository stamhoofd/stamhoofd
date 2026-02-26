import { Organization } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

export const OrganizationLogger = new ModelLogger(Organization, {
    skipKeys: ['searchIndex', 'serverMeta'],
    optionsGenerator: getDefaultGenerator<Organization>({
        created: AuditLogType.OrganizationAdded,
        updated: AuditLogType.OrganizationEdited,
        deleted: AuditLogType.OrganizationDeleted,
    }),

    postProcess(event, options, log) {
        log.organizationId = event.model.id;

        if (log.type === AuditLogType.OrganizationDeleted) {
            // Never belongs to an organization - could cause constraint errors
            log.organizationId = null;
        }
    },

    createReplacements: (model, options) => {
        return new Map([
            ['org', AuditLogReplacement.create({
                id: options.data.model.id,
                value: options.data.model.name,
                type: AuditLogReplacementType.Organization,
            })],
        ]);
    },
});
