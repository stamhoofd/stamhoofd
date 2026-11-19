import { MapDecoder, StringDecoder } from '@common/encoding';
import { column } from '@node/database';
import { QueryableModel } from '@stamhoofd/sql';
import { DataRetentionOverview } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export enum DataRetentionRunPhase {
    Members = 'Members',
    Orders = 'Orders',
}

/**
 * The nightly data retention run of a tenant. A run can take several nights, so it is stored here instead of in memory,
 * where it would not survive a deploy.
 */
export class DataRetentionRun extends QueryableModel {
    static table = 'data_retention_runs';

    @column({
        primary: true,
        type: 'string',
        beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    tenantId: string;

    /**
     * What the running run is looping over. Null when no run is in progress.
     */
    @column({ type: 'string', nullable: true })
    phase: DataRetentionRunPhase | null = null;

    /**
     * The last id that was processed in the current phase.
     */
    @column({ type: 'string', nullable: true })
    cursor: string | null = null;

    /**
     * Counts of the running run, per organization id, and 'platform' for the platform as a whole.
     */
    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, DataRetentionOverview) })
    progress = new Map<string, DataRetentionOverview>();

    /**
     * Counts of the last complete run, in the same format as progress.
     */
    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, DataRetentionOverview) })
    result = new Map<string, DataRetentionOverview>();

    @column({ type: 'datetime', nullable: true })
    startedAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    finishedAt: Date | null = null;

    @column({
        type: 'datetime',
        beforeSave(old?: any) {
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
        type: 'datetime',
        beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    static async getOrCreate(tenantId: string): Promise<DataRetentionRun> {
        const existing = await DataRetentionRun.select().where('tenantId', tenantId).first(false);
        if (existing) {
            return existing;
        }
        const run = new DataRetentionRun();
        run.tenantId = tenantId;
        await run.save();
        return run;
    }
}
