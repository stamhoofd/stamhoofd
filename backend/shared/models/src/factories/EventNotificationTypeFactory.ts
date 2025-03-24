import { Factory } from '@simonbackx/simple-database';
import { EventNotificationType, RecordCategory } from '@stamhoofd/structures';

import { Platform } from '../models/Platform';

class Options {
    title?: string;
    recordCategories?: RecordCategory[];
}

export class EventNotificationTypeFactory extends Factory<Options, EventNotificationType> {
    async create(): Promise<EventNotificationType> {
        const eventType = EventNotificationType.create({
            title: this.options.title ?? ('Melding ' + (new Date().getTime() + Math.floor(Math.random() * 999999))),
        });

        eventType.recordCategories = this.options.recordCategories ?? [];

        // Add to platform
        const platform = await Platform.getForEditing();
        platform.config.eventNotificationTypes.push(eventType);
        await platform.save();

        return eventType;
    }
}
