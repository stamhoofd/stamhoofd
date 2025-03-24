import { Factory } from '@simonbackx/simple-database';
import { PlatformEventType } from '@stamhoofd/structures';

import { Platform } from '../models/Platform';

class Options {
    name?: string;
}

export class PlatformEventTypeFactory extends Factory<Options, PlatformEventType> {
    async create(): Promise<PlatformEventType> {
        const eventType = PlatformEventType.create({
            name: this.options.name ?? ('Responsibility ' + (new Date().getTime() + Math.floor(Math.random() * 999999))),
        });

        // Add to platform
        const platform = await Platform.getForEditing();
        platform.config.eventTypes.push(eventType);
        await platform.save();

        return eventType;
    }
}
