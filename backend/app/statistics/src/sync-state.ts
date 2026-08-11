import { getStatisticsConnection } from '@stamhoofd/statistics-db/connection';

export const syncStateTable = 'stats_sync_state';

export type SyncState = {
    tableName: string;
    watermark: Date | null;
    lastSucceededAt: Date | null;
    lastReconciledAt: Date | null;
};

/**
 * The watermark to store after a run: the highest `updatedAt` that was seen, but never beyond the
 * moment the run started.
 *
 * Source rows can carry an `updatedAt` in the future — periods in this database do. Following one
 * would park the watermark weeks ahead, and every row written in the meantime would fall below it and
 * be skipped. Capping costs one row that is read again on every run until the clock catches up, and
 * repairs a watermark that a previous run already pushed into the future.
 */
export function nextWatermark(previous: Date | null, seen: Date[], runStartedAt: Date): Date | null {
    let watermark = previous;

    for (const date of seen) {
        if (!watermark || date > watermark) {
            watermark = date;
        }
    }

    return watermark && watermark > runStartedAt ? runStartedAt : watermark;
}

export async function readSyncState(tableName: string): Promise<SyncState> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(
        `SELECT \`tableName\`, \`watermark\`, \`lastSucceededAt\`, \`lastReconciledAt\` FROM ${connection.escapeId(syncStateTable)} WHERE \`tableName\` = ?`,
        [tableName],
        { nestTables: false },
    );
    const row = (rows as unknown as SyncState[])[0];

    return row ?? { tableName, watermark: null, lastSucceededAt: null, lastReconciledAt: null };
}

export async function writeSyncState(tableName: string, state: Partial<Omit<SyncState, 'tableName'>>): Promise<void> {
    const connection = getStatisticsConnection();
    const columns = ['tableName', 'updatedAt', ...Object.keys(state)];
    const values = [tableName, new Date(), ...Object.values(state)];
    const assignments = columns.filter(column => column !== 'tableName').map(column => `${connection.escapeId(column)} = new.${connection.escapeId(column)}`);

    await connection.insert(
        `INSERT INTO ${connection.escapeId(syncStateTable)} (${columns.map(column => connection.escapeId(column)).join(', ')}) VALUES (?) AS new ON DUPLICATE KEY UPDATE ${assignments.join(', ')}`,
        [values],
    );
}
