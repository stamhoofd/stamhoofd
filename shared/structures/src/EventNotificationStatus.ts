export enum EventNotificationStatus {
    Draft = 'Draft',
    Pending = 'Pending',
    Accepted = 'Accepted',
    PartiallyAccepted = 'PartiallyAccepted',
    Rejected = 'Rejected',
}

export class EventNotificationStatusHelper {
    public static getName(status: EventNotificationStatus): string {
        switch (status) {
            case EventNotificationStatus.Draft:
                return $t('3771b48b-2385-47ac-b948-9f7ff6d1988e');
            case EventNotificationStatus.Pending:
                return $t('62bee5f8-3532-4eee-8281-ff6df193d190');
            case EventNotificationStatus.Accepted:
                return $t('372e7507-9f34-4360-bb44-25e324ff36c6');
            case EventNotificationStatus.PartiallyAccepted:
                return $t('0dd9b51d-792f-4f97-9284-70404600581c');
            case EventNotificationStatus.Rejected:
                return $t('1ff072f8-6913-4b85-a1e4-4e4ecc1a1bf4');
        }
    }
}
