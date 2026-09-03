/**
 * Formatted as '<subject>.<event>'. The payload of a notification depends on its type.
 */
export enum NotificationType {
    RegistrationCreated = 'registration.created',
}

export class NotificationTypeHelper {
    static getName(type: NotificationType): string {
        switch (type) {
            case NotificationType.RegistrationCreated:
                return $t('%Zqp');
        }
    }
}
