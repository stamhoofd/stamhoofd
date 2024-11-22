import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Document, Group, Member, Registration } from '@stamhoofd/models';
import { AuditLogType, EmailTemplateType } from '@stamhoofd/structures';
import { GroupService } from './GroupService';
import { AuditLogService } from './AuditLogService';

export const RegistrationService = {
    async markValid(registrationId: string) {
        const registration = await Registration.getByID(registrationId);
        if (!registration) {
            throw new Error('Registration not found');
        }

        if (registration.registeredAt !== null && registration.deactivatedAt === null) {
            return false;
        }

        registration.reservedUntil = null;
        registration.registeredAt = registration.registeredAt ?? new Date();
        registration.deactivatedAt = null;
        registration.canRegister = false;
        await registration.save();
        registration.scheduleStockUpdate();

        await Member.updateMembershipsForId(registration.memberId);

        await registration.sendEmailTemplate({
            type: EmailTemplateType.RegistrationConfirmation,
        });

        const member = await Member.getByID(registration.memberId);
        if (member) {
            const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
            registrationMemberRelation.foreignKey = Member.registrations.foreignKey;
            await Document.updateForRegistration(registration.setRelation(registrationMemberRelation, member));
        }

        // Update group occupancy
        const group = await GroupService.updateOccupancy(registration.groupId);

        // Create a log
        if (member && group) {
            await AuditLogService.log({
                type: AuditLogType.MemberRegistered,
                member,
                group,
                registration,
            });
        }

        return true;
    },

    async deactivate(registration: Registration, group?: Group, member?: Member) {
        if (registration.deactivatedAt !== null) {
            return;
        }

        // Clear the registration
        registration.deactivatedAt = new Date();
        await registration.save();
        registration.scheduleStockUpdate();

        await Member.updateMembershipsForId(registration.memberId);

        const fetchedMember = member ?? await Member.getByID(registration.memberId);
        const fetchedGroup = group ?? await Group.getByID(registration.groupId);

        if (fetchedMember && fetchedGroup) {
            await AuditLogService.log({
                type: AuditLogType.MemberUnregistered,
                member: fetchedMember,
                group: fetchedGroup,
                registration,
            });
        }
    },
};