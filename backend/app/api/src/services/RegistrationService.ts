import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Document, Member, Registration } from '@stamhoofd/models';
import { EmailTemplateType } from '@stamhoofd/structures';
import { GroupService } from './GroupService';

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
        await GroupService.updateOccupancy(registration.groupId);

        // todo: log audit

        return true;
    },
};
