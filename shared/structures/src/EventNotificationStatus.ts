export enum EventNotificationStatus {
    Draft = 'Draft',
    Pending = 'Pending',
    Accepted = 'Accepted',
    Rejected = 'Rejected',
}

export class EventNotificationStatusHelper {
    public static getName(status: EventNotificationStatus): string {
        switch (status) {
            case EventNotificationStatus.Draft:
                return $t('klad');
            case EventNotificationStatus.Pending:
                return $t('ingediend');
            case EventNotificationStatus.Accepted:
                return $t('goedgekeurd');
            case EventNotificationStatus.Rejected:
                return $t('afgekeurd');
        }
    }
}
