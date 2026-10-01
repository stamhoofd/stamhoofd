import type { Platform } from '../Platform.js';
import type { UserPermissions } from '../UserPermissions.js';

/**
 * Formatted as '<subject>.<event>'. The payload of a notification depends on its type.
 */
export enum NotificationType {
    RegistrationCreated = 'registration.created',
}

/**
 * Who can receive a notification type. Users only see preferences for the types they can receive.
 */
export enum NotificationAudience {
    Users = 'users',
    OrganizationAdmins = 'organizationAdmins',
    PlatformAdmins = 'platformAdmins',
}

export class NotificationTypeHelper {
    static getName(type: NotificationType): string {
        switch (type) {
            case NotificationType.RegistrationCreated:
                return $t('%Zqp');
        }
    }

    static getAudience(type: NotificationType): NotificationAudience {
        switch (type) {
            case NotificationType.RegistrationCreated:
                return NotificationAudience.OrganizationAdmins;
        }
    }

    static isKnown(type: string): type is NotificationType {
        return Object.values(NotificationType).includes(type as NotificationType);
    }

    static isRelevantFor(type: NotificationType, user: { permissions: UserPermissions | null }, platform: Platform): boolean {
        const permissions = user.permissions;

        switch (this.getAudience(type)) {
            case NotificationAudience.Users:
                return true;
            case NotificationAudience.OrganizationAdmins:
                // Only administrators with permissions in an organization receive these notifications
                return !!permissions && permissions.organizationPermissions.size > 0;
            case NotificationAudience.PlatformAdmins:
                return !!permissions?.forPlatform(platform)?.hasFullAccess();
        }
    }

    static getRelevantTypes(user: { permissions: UserPermissions | null }, platform: Platform): NotificationType[] {
        return Object.values(NotificationType).filter(type => this.isRelevantFor(type, user, platform));
    }
}
