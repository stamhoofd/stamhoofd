import { Group, Member, Registration } from '@stamhoofd/models';
import { ModelLogger } from './ModelLogger.js';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

export const RegistrationLogger = new ModelLogger(Registration, {
    async optionsGenerator(event) {
        if (event.type === 'created' && event.model.registeredAt === null) {
            // Ignored for now
            return;
        }
        const wasActive = event.type === 'updated' ? (!event.originalFields.deactivatedAt && !!event.originalFields.registeredAt) : true;
        const isActive = event.type === 'deleted' ? false : (!event.model.deactivatedAt && !!event.model.registeredAt);

        if (wasActive === isActive) {
            return;
        }

        const member = await Member.getByID(event.model.memberId);
        const group = await Group.getByID(event.model.groupId);

        if (!member || !group) {
            return;
        }

        return {
            type: wasActive ? AuditLogType.MemberUnregistered : AuditLogType.MemberRegistered,
            generatePatchList: false,
            data: { member, group },
            objectId: member.id,
        };
    },

    createReplacements(_, { data }) {
        return new Map([
            ['m', AuditLogReplacement.create({
                id: data.member.id,
                value: data.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
            ['g', AuditLogReplacement.create({
                id: data.group.id,
                value: data.group.settings.name.toString(),
                type: AuditLogReplacementType.Group,
            })],
        ]);
    },

    generateDescription(event, options) {
        const d = event.model.setRelation(Registration.group, options.data.group).getStructure();
        return d.description;
    },

});
