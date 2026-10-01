import type { Group, Registration } from '@stamhoofd/models';
import { Member, Organization, Platform, User } from '@stamhoofd/models';
import { NamedObject, PermissionLevel } from '@stamhoofd/structures';
import { NotificationSubjectType } from '@stamhoofd/structures/notifications/NotificationSubjectType.js';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { RegistrationCreatedNotificationPayload } from '@stamhoofd/structures/notifications/RegistrationCreatedNotificationPayload.js';
import { AdminPermissionChecker } from '../helpers/AdminPermissionChecker.js';
import { NotificationService } from './NotificationService.js';

const featureFlag = 'notifications';

export class RegistrationNotificationService {
    /**
     * Notifies the administrators that can read the group, when a registration the member started themselves became valid
     */
    static async notifyRegistrationCreated(registration: Registration, group: Group) {
        if (!registration.registeredByMember) {
            return;
        }

        const organization = await Organization.getByID(registration.organizationId);
        const platform = await Platform.getSharedPrivateStruct();
        if (!organization || (!platform.config.featureFlags.includes(featureFlag) && !organization.privateMeta.featureFlags.includes(featureFlag))) {
            return;
        }

        const member = await Member.getByIdWithUsers(registration.memberId);
        if (!member) {
            return;
        }

        // Administrators that registered their own family don't need to be notified about it
        const memberUserIds = new Set(member.users.map(u => u.id));
        const recipients: User[] = [];

        for (const admin of await User.getAdmins(organization.id)) {
            if (memberUserIds.has(admin.id)) {
                continue;
            }
            const checker = new AdminPermissionChecker(admin, platform, organization);
            if (await checker.canAccessGroup(group, PermissionLevel.Read)) {
                recipients.push(admin);
            }
        }

        if (recipients.length === 0) {
            return;
        }

        await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: RegistrationCreatedNotificationPayload.create({
                group: NamedObject.create({ id: group.id, name: group.settings.name.toString() }),
            }).encodeBoxed(),
            organizationId: organization.id,
            subjectType: NotificationSubjectType.Member,
            subjectId: member.id,
            group: {
                key: group.id,
                resource: NamedObject.create({ id: member.id, name: member.details.name }),
            },
            to: { users: recipients },
        });
    }
}
