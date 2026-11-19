import { EncodeMedium, MapDecoder, ObjectData, StringDecoder } from '@common/encoding';
import { column } from '@node/database';
import { QueryableModel, SQL, SQLAlias, SQLJsonExtract, SQLSelectAs } from '@stamhoofd/sql';
import { DataRetentionOverview } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export enum DataRetentionRunPhase {
    Members = 'Members',
    Orders = 'Orders',
    /**
     * E-mails, documents and audit logs, per organization.
     */
    OrganizationData = 'OrganizationData',
    /**
     * E-mails and audit logs without an organization.
     */
    PlatformData = 'PlatformData',
    Accounts = 'Accounts',
}

/**
 * The nightly data retention run of a tenant. A run can take several nights, so it is stored here instead of in memory,
 * where it would not survive a deploy.
 */
export class DataRetentionRun extends QueryableModel {
    static table = 'data_retention_runs';

    /**
     * The key in progress and result for the platform as a whole.
     */
    static readonly PLATFORM_SCOPE = 'platform';

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
     * The last id that was processed in the current phase. The PlatformData phase has a single step, and stores 'done' once it ran.
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

    /**
     * The counts of one organization, or of the platform, in the last complete run. Null when no run completed yet.
     * Reads only that part of the result: it holds the counts of every organization, which can be large on a platform.
     */
    static async getOverview(
        tenantId: string,
        scope: string,
    ): Promise<DataRetentionOverview | null> {
        const row = await SQL.select(
            SQL.column('finishedAt'),
            new SQLSelectAs(
                SQL.jsonExtract(
                    SQL.column('result'),
                    `$.value.${SQLJsonExtract.escapePathComponent(scope)}`,
                    true,
                ),
                new SQLAlias('data__overview'),
            ),
            new SQLSelectAs(
                SQL.jsonExtract(SQL.column('result'), '$.version'),
                new SQLAlias('data__version'),
            ),
        )
            .from(DataRetentionRun.table)
            .where('tenantId', tenantId)
            .first(false);

        const finishedAt = row?.[DataRetentionRun.table].finishedAt as Date | null | undefined;
        if (!row || !finishedAt) {
            return null;
        }

        const overview = parseJson(row.data.overview);
        if (overview === null) {
            // Nothing was counted for this scope
            return DataRetentionOverview.create({ calculatedAt: finishedAt });
        }
        const version = parseJson(row.data.version);
        if (typeof version !== 'number') {
            throw new Error('The result of a data retention run has no version');
        }
        return DataRetentionOverview.decode(
            new ObjectData(overview, { version, medium: EncodeMedium.Database }),
        );
    }

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

/**
 * JSON_EXTRACT returns JSON, which the driver can return as a string or already parsed.
 * Only for JSON objects and numbers: a JSON string that was already parsed would be parsed a second time.
 */
function parseJson(value: unknown): unknown {
    if (typeof value === 'string') {
        return JSON.parse(value) as unknown;
    }
    return value ?? null;
}
