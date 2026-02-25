import { Organization, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
import { AuditLogPatchItem, AuditLogPatchItemType, AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.OrganizationEdited,
    updated: AuditLogType.OrganizationEdited,
    deleted: AuditLogType.OrganizationEdited,
});

export const OrganizationRegistrationPeriodLogger = new ModelLogger(OrganizationRegistrationPeriod, {
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        // Load data
        const organization = await Organization.getByID(event.model.organizationId);
        if (!organization) {
            return;
        }

        const period = await RegistrationPeriod.getByID(event.model.periodId);
        if (!period) {
            return;
        }

        return {
            ...result,
            data: {
                organization,
                period,
            },
        };
    },

    createReplacements(_, { data }) {
        return new Map([
            ['o', AuditLogReplacement.create({
                id: data.organization.id,
                value: data.organization.name,
                type: AuditLogReplacementType.Organization,
            })],
        ]);
    },

    postProcess(event, options, log) {
        const prependKey = AuditLogReplacement.create({
            id: event.model.periodId,
            value: options.data.period.getStructure().name,
            type: AuditLogReplacementType.RegistrationPeriod,
        });

        // Prefix changes
        for (const item of log.patchList) {
            item.key = item.key.prepend(prependKey);
        }

        if (event.type === 'created') {
            // Add create patch
            log.patchList.push(AuditLogPatchItem.create({
                key: prependKey,
                type: AuditLogPatchItemType.Added,
            }));
        }

        if (event.type === 'deleted') {
            // Add delete patch
            log.patchList.push(AuditLogPatchItem.create({
                key: prependKey,
                type: AuditLogPatchItemType.Removed,
            }));
        }
    },
});
