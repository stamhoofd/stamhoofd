import { Factory } from '@simonbackx/simple-database';
import { EventNotificationStatus } from '@stamhoofd/structures';

import { EventNotification } from '../models';
import { Event } from '../models/Event';
import { Organization } from '../models/Organization';
import { EventFactory } from './EventFactory';
import { EventNotificationTypeFactory } from './EventNotificationTypeFactory';

class Options {
    organization: Organization;
    events?: Event[];
    typeId?: string;
    status?: EventNotificationStatus;
    feedbackText?: string;
    periodId?: string;
}

export class EventNotificationFactory extends Factory<Options, EventNotification> {
    async create(): Promise<EventNotification> {
        const eventNotification = new EventNotification();

        eventNotification.organizationId = this.options.organization.id;
        eventNotification.typeId = this.options.typeId ?? (await new EventNotificationTypeFactory({}).create()).id;
        eventNotification.status = this.options.status ?? EventNotificationStatus.Draft;
        eventNotification.createdBy = null;
        eventNotification.feedbackText = this.options.feedbackText ?? null;

        const events = this.options.events ?? [await new EventFactory({ organization: this.options.organization }).create()];

        eventNotification.startDate = events[0].startDate;
        eventNotification.endDate = events[0].endDate;
        eventNotification.periodId = this.options.periodId ?? this.options.organization.periodId;

        await eventNotification.save();

        // Link events
        await EventNotification.events.link(eventNotification, events);
        return eventNotification;
    }
}
