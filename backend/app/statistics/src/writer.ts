import { getStatisticsConnection } from './connection.js';
import type { StatisticsRow } from './rows.js';

/**
 * The number of statistics rows written per statement, and the number of source ids checked per
 * query while reconciling deletes.
 */
export const batchSize = 500;

export function buildUpsertQuery(table: string, columns: string[], escapeId: (value: string) => string): string {
    const assignments = columns
        .filter(column => column !== 'id')
        .map(column => `${escapeId(column)} = new.${escapeId(column)}`);

    // The row alias is the MySQL 8 replacement for VALUES(col), which is deprecated.
    return `INSERT INTO ${escapeId(table)} (${columns.map(escapeId).join(', ')}) VALUES ? AS new`
        + (assignments.length > 0 ? ` ON DUPLICATE KEY UPDATE ${assignments.join(', ')}` : '');
}

/**
 * Write rows, replacing the ones that are already there. Running the same batch twice is a no-op, so
 * a run that crashed halfway can simply be repeated.
 */
export async function upsertRows(table: string, columns: string[], rows: StatisticsRow[]): Promise<number> {
    if (rows.length === 0) {
        return 0;
    }

    const connection = getStatisticsConnection();
    const query = buildUpsertQuery(table, columns, value => connection.escapeId(value));

    for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize).map(row => columns.map(column => row[column] ?? null));
        await connection.insert(query, [batch]);
    }

    return rows.length;
}

export async function deleteRows(table: string, ids: string[]): Promise<number> {
    if (ids.length === 0) {
        return 0;
    }

    const connection = getStatisticsConnection();
    const [result] = await connection.delete(`DELETE FROM ${connection.escapeId(table)} WHERE \`id\` IN (?)`, [ids]);
    return result.affectedRows;
}

/**
 * The ids a source still holds in a statistics table, in pages, so reconciling never keeps the whole
 * table in memory.
 *
 * Scoped to one source on purpose: the rows an import produced have no counterpart in the main
 * database, so reconciling them against it would delete every one of them on the first night.
 */
export async function* iterateIds(table: string, source: string): AsyncGenerator<string[]> {
    const connection = getStatisticsConnection();
    let cursor = '';

    for (;;) {
        const [rows] = await connection.select(
            `SELECT \`id\` FROM ${connection.escapeId(table)} WHERE \`source\` = ? AND \`id\` > ? ORDER BY \`id\` ASC LIMIT ${batchSize}`,
            [source, cursor],
            { nestTables: false },
        );
        const ids = (rows as unknown as { id: string }[]).map(row => row.id);
        if (ids.length === 0) {
            return;
        }

        yield ids;
        cursor = ids[ids.length - 1];
    }
}
