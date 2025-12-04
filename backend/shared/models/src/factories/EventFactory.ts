import { Factory } from '@simonbackx/simple-database';
import { EventMeta } from '@stamhoofd/structures';

import { Event } from '../models/Event.js';
import { Organization } from '../models/Organization.js';
import { PlatformEventTypeFactory } from './PlatformEventTypeFactory.js';
import { Group } from '../models/Group.js';

class Options {
    organization?: Organization;
    name?: string;
    meta?: EventMeta;
    startDate?: Date;
    endDate?: Date;
    typeId?: string;
    group?: Group;
}

export class EventFactory extends Factory<Options, Event> {
    async create(): Promise<Event> {
        const event = new Event();

        event.organizationId = this.options.organization?.id ?? null;
        event.typeId = this.options.typeId ?? (await new PlatformEventTypeFactory({}).create()).id;
        event.startDate = this.options.startDate ?? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        event.endDate = this.options.endDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        event.name = this.options.name ?? 'Event ' + (new Date().getTime() + Math.floor(Math.random() * 999999));
        event.meta = this.options.meta ?? EventMeta.create({});
        event.groupId = this.options.group?.id ?? null;

        await event.save();

        if (this.options.group) {
            await event.syncGroupRequirements(this.options.group);
        }
        return event;
    }
}
