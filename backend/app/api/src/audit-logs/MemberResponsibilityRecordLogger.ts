import { Group, Member, MemberResponsibilityRecord, Organization, Platform } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.MemberResponsibilityRecordAdded,
    updated: AuditLogType.MemberResponsibilityRecordEdited,
    deleted: AuditLogType.MemberResponsibilityRecordDeleted,
});

export const MemberResponsibilityRecordLogger = new ModelLogger(MemberResponsibilityRecord, {
    skipKeys: ['balanceItemId'],
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        const member = await Member.getByID(event.model.memberId);
        const group = event.model.groupId ? (await Group.getByID(event.model.groupId)) : null;
        const organization = event.model.organizationId ? (await Organization.getByID(event.model.organizationId)) : null;

        if (!member) {
            console.log('No member found for MemberResponsibilityRecord', event.model.id);
            return;
        }

        if (event.type === 'updated' && event.changedFields.endDate && event.originalFields.endDate === null) {
            result.type = AuditLogType.MemberResponsibilityRecordDeleted;
            result.generatePatchList = false;
        }

        return {
            ...result,
            data: {
                member,
                group,
                platform: await Platform.getSharedStruct(),
                organization,
            },
            objectId: event.model.memberId,
        };
    },

    createReplacements(model, options) {
        const name = options.data.platform.config.responsibilities.find(r => r.id === model.responsibilityId)?.name;
        const map = new Map([
            ['r', AuditLogReplacement.create({
                id: model.responsibilityId,
                value: name,
                type: AuditLogReplacementType.MemberResponsibility,
            })],
            ['m', AuditLogReplacement.create({
                id: options.data.member.id,
                value: options.data.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);

        if (options.data.organization) {
            map.set('o', AuditLogReplacement.create({
                id: options.data.organization.id,
                value: options.data.organization.name,
                type: AuditLogReplacementType.Organization,
            }));
        }

        if (options.data.group) {
            map.set('g', AuditLogReplacement.create({
                id: options.data.group.id,
                value: options.data.group.settings.name,
                type: AuditLogReplacementType.Group,
            }));
        }

        return map;
    },

    postProcess(event, options, log) {
        log.organizationId = options.data.organization?.id ?? null;
    },
});
