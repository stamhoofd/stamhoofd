import { column } from '@simonbackx/simple-database';
import { ArrayDecoder, Decoder, MapDecoder, StringDecoder, StringOrNumberDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { AuditLogPatchItem, AuditLogReplacement, AuditLogSource, AuditLogType, getAuditLogTypeReplacements } from '@stamhoofd/structures';
import { v7 as uuidv7 } from 'uuid';

export class AuditLog extends QueryableModel {
    static table = 'audit_logs';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            // We use uuidv7 to keep the order of the logs
            return value ?? uuidv7();
        },
    })
    id!: string;

    @column({
        type: 'string',
        nullable: true,
    })
    externalId: string | null = null;

    @column({ type: 'string' })
    source: AuditLogSource = AuditLogSource.System;

    @column({ type: 'string' })
    type: AuditLogType = AuditLogType.Unknown;

    /**
     * Set to make the log visible for this specific organization - otherwise it is private for the platform
     */
    @column({ type: 'string', nullable: true })
    organizationId: string | null;

    /**
     * User who performed the action
     */
    @column({ type: 'string', nullable: true })
    userId: string | null = null;

    /**
     * Main involved object ID - e.g. the member id.
     * Or an email address in case it is email related and we don't have a member or user id
     */
    @column({ type: 'string', nullable: true })
    objectId: string | null = null;

    @column({ type: 'string' })
    description: string = '';

    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, AuditLogReplacement as Decoder<AuditLogReplacement>) })
    replacements: Map<string, AuditLogReplacement> = new Map();

    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, StringOrNumberDecoder) })
    meta: Map<string, string | number> = new Map();

    @column({ type: 'json', decoder: new ArrayDecoder(AuditLogPatchItem as Decoder<AuditLogPatchItem>) })
    patchList: AuditLogPatchItem[] = [];

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

    validate() {
        const replacements = getAuditLogTypeReplacements(this.type);
        for (const replacement of replacements) {
            if (!this.replacements.has(replacement)) {
                throw new Error(`Missing replacement ${replacement}`);
            }
        }
    }
}
