import { Database, Migration } from '@simonbackx/simple-database';

/**
 * taxDependent was a PropertyFilter before it became a boolean, so every records configuration
 * saved in the meantime holds a value the boolean decoder rejects.
 *
 * The models can't be loaded to repair this, so the stored JSON is rewritten directly.
 */
export function normalizeTaxDependent(value: unknown): boolean {
    let changed = false;

    const walk = (node: unknown) => {
        if (Array.isArray(node)) {
            for (const item of node) {
                walk(item);
            }
            return;
        }

        if (node === null || typeof node !== 'object') {
            return;
        }

        const object = node as Record<string, unknown>;

        for (const key of Object.keys(object)) {
            const child = object[key];

            if (key === 'recordsConfiguration' && child !== null && typeof child === 'object' && !Array.isArray(child)) {
                const configuration = child as Record<string, unknown>;

                if ('taxDependent' in configuration && typeof configuration.taxDependent !== 'boolean') {
                    // A PropertyFilter means it was enabled, null means it never was
                    configuration.taxDependent = configuration.taxDependent !== null;
                    changed = true;
                }
            }

            walk(child);
        }
    };

    walk(value);
    return changed;
}

export async function normalizeTaxDependentColumn(table: string, column: string) {
    const [rows] = await Database.select('SELECT `id`, `' + column + '` FROM `' + table + '`');
    let updated = 0;

    for (const row of rows) {
        const record = (row[table] ?? row) as Record<string, unknown>;
        const value = record[column];

        if (value === null || value === undefined) {
            continue;
        }

        const parsed = typeof value === 'string' ? JSON.parse(value) : value;

        if (normalizeTaxDependent(parsed)) {
            await Database.update('UPDATE `' + table + '` SET `' + column + '` = ? WHERE `id` = ?', [JSON.stringify(parsed), record['id']]);
            updated++;
        }
    }

    return updated;
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'production' || STAMHOOFD.environment === 'staging') {
        // taxDependent was never released, so only development and test databases can hold the old value
        console.log('skipped outside development');
        return;
    }

    for (const [table, column] of [['organizations', 'meta'], ['platform', 'config'], ['groups', 'settings']] as const) {
        const updated = await normalizeTaxDependentColumn(table, column);
        console.log('Normalized taxDependent in ' + updated + ' ' + table + ' rows');
    }
});
