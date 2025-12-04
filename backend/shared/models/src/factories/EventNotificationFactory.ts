import { Factory } from '@simonbackx/simple-database';
import { EventNotificationStatus, RecordAnswer } from '@stamhoofd/structures';

import { EventNotification, User } from '../models/index.js';
import { Event } from '../models/Event.js';
import { Organization } from '../models/Organization.js';
import { EventFactory } from './EventFactory.js';
import { EventNotificationTypeFactory } from './EventNotificationTypeFactory.js';

class Options {
    organization: Organization;
    events?: Event[];
    typeId?: string;
    status?: EventNotificationStatus;
    feedbackText?: string;
    periodId?: string;
    recordAnswers?: Map<string, RecordAnswer>;
    acceptedRecordAnswers?: Map<string, RecordAnswer>;
    submittedBy?: User | null;
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

        // Set record answers
        eventNotification.recordAnswers = this.options.recordAnswers ?? new Map();
        eventNotification.acceptedRecordAnswers = this.options.acceptedRecordAnswers ?? new Map();

        eventNotification.submittedBy = this.options.submittedBy?.id ?? null;
        eventNotification.submittedAt = this.options.submittedBy ? new Date() : null;

        await eventNotification.save();

        // Link events
        await EventNotification.events.link(eventNotification, events);
        return eventNotification;
    }
}
