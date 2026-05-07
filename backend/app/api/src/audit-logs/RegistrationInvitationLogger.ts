import { Group, Member, RegistrationInvitation } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

const defaultGenerator = getDefaultGenerator<RegistrationInvitation>({
        created: AuditLogType.RegistrationInvitationAdded,
        updated: AuditLogType.RegistrationInvitationEdited,
        deleted: AuditLogType.RegistrationInvitationDeleted,
});

export const RegistrationInvitationLogger = new ModelLogger(RegistrationInvitation, {
        async optionsGenerator(event) {
            const result = await defaultGenerator(event);
            if (!result) {
                return;
            }
    
            const member = await Member.getByID(event.model.memberId);
            const group = await Group.getByID(event.model.groupId);
    
            if (!member || !group) {
                return;
            }
    
            return {
                ...result,
                data: {
                    member,
                    group,
                },
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
});
