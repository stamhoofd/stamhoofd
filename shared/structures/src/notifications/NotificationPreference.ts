import { AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { NotificationChannel } from './NotificationChannel.js';
import type { NotificationType } from './NotificationType.js';

/**
 * Missing preferences are enabled.
 * `type` and `channel` are decoded as plain strings so older clients keep working when new values are added.
 */
export class NotificationPreference extends AutoEncoder {
    @field({ decoder: StringDecoder })
    type: NotificationType;

    @field({ decoder: StringDecoder })
    channel: NotificationChannel;

    @field({ decoder: BooleanDecoder })
    enabled = true;
}
