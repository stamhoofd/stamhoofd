import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Event, NamedObject } from './Event.js';
import { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { ObjectWithRecords } from './members/ObjectWithRecords.js';
import { RecordAnswer, RecordAnswerDecoder } from './members/records/RecordAnswer.js';
import { RecordSettings } from './members/records/RecordSettings.js';

export enum EventNotificationStatus {
    Draft = 'Draft',
    Pending = 'Pending',
    Accepted = 'Accepted',
    Rejected = 'Rejected',
}

export class EventNotification extends AutoEncoder implements ObjectWithRecords {
    @field({ decoder: StringDecoder, optional: true, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    typeId: string;

    @field({ decoder: new ArrayDecoder(Event) })
    events: Event[] = [];

    @field({ decoder: DateDecoder })
    startDate: Date = new Date();

    @field({ decoder: DateDecoder })
    endDate: Date = new Date();

    @field({ decoder: new EnumDecoder(EventNotificationStatus) })
    status = EventNotificationStatus.Draft;

    @field({ decoder: StringDecoder, nullable: true })
    feedbackText: string | null = null;

    @field({ decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder) })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    /**
     * User who submitted the notification
     */
    @field({ decoder: NamedObject, nullable: true })
    submittedBy: NamedObject | null = null;

    /**
     * User who created the notification
     */
    @field({ decoder: NamedObject, nullable: true })
    createdBy: NamedObject | null = null;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder })
    updatedAt = new Date();

    isRecordEnabled(record: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.recordAnswers;
    }

    doesMatchFilter(filter: StamhoofdFilter): boolean {
        // todo
        return true;
    }
}
