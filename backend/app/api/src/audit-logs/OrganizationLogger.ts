import { Organization } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

export const OrganizationLogger = new ModelLogger(Organization, {
    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.OrganizationAdded,
        updated: AuditLogType.OrganizationEdited,
        deleted: AuditLogType.OrganizationDeleted,
    }),

    createReplacements(model) {
        return new Map([
            ['o', AuditLogReplacement.create({
                id: model.id,
                value: model.name,
                type: AuditLogReplacementType.Organization,
            })],
        ]);
    },

    postProcess(event, options, log) {
        log.organizationId = event.model.id;
    },
});
