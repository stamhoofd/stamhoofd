import { column, ManyToManyRelation } from '@simonbackx/simple-database';
import { MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { EventNotificationStatus, RecordAnswer, RecordAnswerDecoder } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { Event } from './Event.js';

export class EventNotification extends QueryableModel {
    static table = 'event_notifications';

    @column({ primary: true, type: 'string', beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: 'string' })
    typeId: string;

    @column({ type: 'string' })
    periodId: string;

    @column({ type: 'datetime' })
    startDate: Date;

    @column({ type: 'datetime' })
    endDate: Date;

    @column({ type: 'string' })
    status = EventNotificationStatus.Draft;

    /**
     * Feedback on a review, e.g. when it is declined (explains which changes need to be made).
     * It is only visible when the status is not 'accepted' or 'pending'.
     */
    @column({ type: 'string', nullable: true })
    feedbackText: string | null = null;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder) })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    /**
     * Contains the answers of an event notification that were accepted
     */
    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder) })
    acceptedRecordAnswers: Map<string, RecordAnswer> = new Map();

    @column({ type: 'string', nullable: true })
    createdBy: string | null = null;

    @column({ type: 'string', nullable: true })
    submittedBy: string | null = null;

    @column({ type: 'datetime', nullable: true })
    submittedAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    // Note: all relations should point to their parents, not the other way around to avoid reference cycles
    static events = new ManyToManyRelation(EventNotification, Event, 'events');
}
