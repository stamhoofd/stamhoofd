import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { Address } from './addresses/Address.js';
import { Image } from './files/Image.js';
import { Group } from './Group.js';
import { Platform } from './Platform.js';
import { RichText } from './RichText.js';

export class EventLocation extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: Address, nullable: true })
    address: Address | null = null;
}

/**
 * In case we need to cache the name, to properly display information without having to fetch loads of data
 */
export class NamedObject extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';
}

export class EventMeta extends AutoEncoder {
    /**
     * Contains the name of the organization for displaying the event
     */
    @field({ decoder: NamedObject, nullable: true, version: 311 })
    organizationCache: NamedObject | null = null;

    @field({ decoder: RichText })
    description = RichText.create({});

    @field({ decoder: BooleanDecoder })
    visible = true;

    @field({ decoder: EventLocation, nullable: true })
    location: EventLocation | null = null;

    /**
     * A valid membership is required for one of these default age groups
     *
     * null = no restriction
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    defaultAgeGroupIds: string[] | null = null;

    /**
     * A valid membership is required for one of these specific groups
     * (only if organizationId is set)
     *
     * null = no restriction
     */
    @field({ decoder: new ArrayDecoder(NamedObject), nullable: true, version: 302 })
    groups: NamedObject[] | null = null;

    /**
     * A valid membership is required for an organization with one of these tags
     *
     * null = no restriction (unless organizationId is set)
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    organizationTagIds: string[] | null = null;

    @field({ decoder: Image, nullable: true })
    coverPhoto: Image | null = null;
}

export class Event extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    typeId = '';

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    @field({ decoder: DateDecoder })
    startDate = new Date();

    @field({ decoder: DateDecoder })
    endDate = new Date();

    @field({ decoder: EventMeta })
    meta: EventMeta = EventMeta.create({});

    @field({ decoder: Group, nullable: true })
    group: Group | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    get dateRange() {
        return Formatter.dateRange(this.startDate, this.endDate);
    }

    static group(events: Event[]) {
        const queue: {
            title: string;
            events: Event[];
        }[] = [];
        const currentYear = Formatter.year(new Date());

        for (const event of events) {
            const year = Formatter.year(event.startDate);
            const title = Formatter.month(event.startDate) + (year !== currentYear ? ` ${year}` : '');

            const group = queue[queue.length - 1];
            if (group && group.title === title) {
                group.events.push(event);
            }
            else {
                queue.push({ title, events: [event] });
            }
        }
        return queue;
    }

    get eventNotificationTypes() {
        return Platform.shared.config.eventNotificationTypes.filter(t => t.eventTypeIds.includes(this.typeId));
    }
}
