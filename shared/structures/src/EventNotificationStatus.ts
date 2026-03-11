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
                return $t('%Az');
            case EventNotificationStatus.Pending:
                return $t('%B0');
            case EventNotificationStatus.Accepted:
                return $t('%B1');
            case EventNotificationStatus.PartiallyAccepted:
                return $t('%Ck');
            case EventNotificationStatus.Rejected:
                return $t('%B2');
        }
    }
}
