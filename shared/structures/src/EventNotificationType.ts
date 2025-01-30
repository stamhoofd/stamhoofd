import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { NamedObject } from './Event';
import { StamhoofdFilter } from './filters/StamhoofdFilter';
import { ObjectWithRecords } from './members/ObjectWithRecords';
import { RecordAnswer, RecordAnswerDecoder } from './members/records/RecordAnswer';
import { RecordCategory } from './members/records/RecordCategory';
import { RecordSettings } from './members/records/RecordSettings';

export enum EventNotificationStatus {
    Draft = 'Draft',
    Pending = 'Pending',
    Accepted = 'Accepted',
    Rejected = 'Rejected',
}

export class EventNotification extends AutoEncoder implements ObjectWithRecords {
    @field({ decoder: StringDecoder, optional: true, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(EventNotificationStatus) })
    status = EventNotificationStatus.Draft;

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

export class EventNotificationDeadline extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Events within this start and end date will need to be accepted before the deadline.
     */
    @field({ decoder: DateDecoder })
    startDate: Date = new Date();

    @field({ decoder: DateDecoder })
    endDate: Date = new Date();

    @field({ decoder: DateDecoder })
    deadline: Date = new Date();

    /**
     * If set, will automatically add a 'quick' action in the 'Start' tab of the dashboard.
     * e.g. "Dien je kampmeldingen voor paaskampen ten laatse in voor 1 maart"
     */
    @field({ decoder: StringDecoder, nullable: true })
    reminderText: string | null = null;

    /**
     * Show reminder from this date until the deadline.
     */
    @field({ decoder: DateDecoder, nullable: true })
    reminderFrom: Date | null = null;
}

export class EventNotificationType extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    eventTypeIds: string[] = [];

    /**
     * Title of this notification. E.g. "Kampmelding"
     */
    @field({ decoder: StringDecoder })
    title: string = '';

    /**
     * Explanation about what this is.
     */
    @field({ decoder: StringDecoder })
    description: string = '';

    /**
     * Button text to fill in this form. E.g. "Kampmelding indienen"
     */
    @field({ decoder: StringDecoder })
    buttonTitle: string = '';

    /**
     * Descriptive text below the button to fill in the form. E.g. "Het indienen van een kampmelding is verplicht voor kampen."
     */
    @field({ decoder: StringDecoder })
    buttonDescription: string = '';

    /**
     * List of deadlines
     */
    @field({ decoder: new ArrayDecoder(EventNotificationDeadline) })
    deadlines: EventNotificationDeadline[] = [];

    /**
     * Questions to anwer. You can create multiple record categories to simulate multiple steps in the process.
     *
     * These are optional and can be an empty array.
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    recordCategories: RecordCategory[] = [];
}
