import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { AuditLog, Group, Member, Registration } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, MemberDetails } from '@stamhoofd/structures';
import { Context } from '../helpers/Context';

export type MemberEditedAuditOptions = {
    type: AuditLogType.MemberEdited;
    memberId: string;
    oldMemberDetails: MemberDetails;
    memberDetailsPatch: AutoEncoderPatchType<MemberDetails>;
};

export type MemberRegisteredAuditOptions = {
    type: AuditLogType.MemberRegistered;
    member: Member;
    group: Group;
    registration: Registration;
};

export type AuditLogOptions = MemberEditedAuditOptions | MemberRegisteredAuditOptions;

export const AuditLogService = {
    async log(options: AuditLogOptions) {
        const userId = Context.optionalAuth?.user?.id ?? null;
        const organizationId = Context.organization?.id ?? null;

        const model = new AuditLog();
        model.type = options.type;
        model.userId = userId;
        model.organizationId = organizationId;

        if (options.type === AuditLogType.MemberRegistered) {
            model.objectId = options.member.id;
            model.replacements = new Map([
                ['m', AuditLogReplacement.create({
                    id: options.member.id,
                    value: options.member.details.name,
                    type: AuditLogReplacementType.Member,
                })],
                ['g', AuditLogReplacement.create({
                    id: options.group.id,
                    value: options.group.settings.name,
                    type: AuditLogReplacementType.Group,
                })],
            ]);

            const registrationStructure = options.registration.setRelation(Registration.group, options.group).getStructure();
            if (registrationStructure.description) {
                model.description = registrationStructure.description;
            }
        }

        // In the future we might group these saves together in one query to improve performance
        await model.save();
    },

};
