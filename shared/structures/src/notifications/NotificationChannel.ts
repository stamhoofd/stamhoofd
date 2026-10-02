export enum NotificationChannel {
    InApp = 'inApp',
    Push = 'push',
}

export class NotificationChannelHelper {
    static getName(channel: NotificationChannel): string {
        switch (channel) {
            case NotificationChannel.InApp:
                return $t('%ZtL');
            case NotificationChannel.Push:
                return $t('%ZtN');
        }
    }

    static isKnown(channel: string): channel is NotificationChannel {
        return Object.values(NotificationChannel).includes(channel as NotificationChannel);
    }
}
