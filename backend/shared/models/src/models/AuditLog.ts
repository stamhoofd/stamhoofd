import { column, Model } from '@simonbackx/simple-database';
import { ArrayDecoder, Decoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { AuditLogPatchItem, AuditLogReplacement, AuditLogType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export class AuditLog extends Model {
    static table = 'audit_logs';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

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
     * Main involved object ID - e.g. the member id
     */
    @column({ type: 'string', nullable: true })
    objectId: string | null = null;

    @column({ type: 'string' })
    description: string = '';

    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, AuditLogReplacement as Decoder<AuditLogReplacement>) })
    replacements: Map<string, AuditLogReplacement> = new Map();

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
}
