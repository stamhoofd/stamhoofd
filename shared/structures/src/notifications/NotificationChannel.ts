export enum NotificationChannel {
    InApp = 'inApp',
    Push = 'push',
}

export class NotificationChannelHelper {
    static getName(channel: NotificationChannel): string {
        switch (channel) {
            case NotificationChannel.InApp:
                return $t('In de app');
            case NotificationChannel.Push:
                return $t('Push');
        }
    }

    static isKnown(channel: string): channel is NotificationChannel {
        return Object.values(NotificationChannel).includes(channel as NotificationChannel);
    }
}
