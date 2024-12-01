import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Document, Group, Member, Registration } from '@stamhoofd/models';
import { AuditLogType, EmailTemplateType } from '@stamhoofd/structures';
import { GroupService } from './GroupService';
import { AuditLogService } from './AuditLogService';

export const RegistrationService = {
    async markValid(registrationId: string) {
        return await AuditLogService.disable(async () => {
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
            await GroupService.updateOccupancy(registration.groupId);

            return true;
        });
    },

    async deactivate(registration: Registration, _group?: Group, _member?: Member) {
        if (registration.deactivatedAt !== null) {
            return;
        }

        return await AuditLogService.disable(async () => {
            // Clear the registration
            registration.deactivatedAt = new Date();
            await registration.save();
            registration.scheduleStockUpdate();

            await Member.updateMembershipsForId(registration.memberId);
        });
    },
};
