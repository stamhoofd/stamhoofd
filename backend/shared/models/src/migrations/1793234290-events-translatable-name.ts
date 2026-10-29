import { Database, Migration } from '@node/database';

async function getColumnType(tableName: string, columnName: string): Promise<string | null> {
    const [rows] = await Database.select(
        'SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [tableName, columnName],
        { nestTables: false },
    );
    const row = rows[0] as { DATA_TYPE?: unknown } | undefined;
    return typeof row?.DATA_TYPE === 'string' ? row.DATA_TYPE : null;
}

/**
 * Converts the `name` column from text to json. MySQL refuses to convert plain text to json directly,
 * so the names are copied into a temporary json column that then replaces the old one.
 *
 * The json column type stores values as `{"value": ..., "version": ...}`, so the existing names are wrapped the same
 * way. A plain string value decodes as a legacy untranslated TranslatedString.
 *
 * Every step checks the current state of the table, so the migration can be retried after a failure.
 */
export async function convertEventNameToJson(tableName = 'events') {
    const escapedTable = '`' + tableName + '`';
    const nameType = await getColumnType(tableName, 'name');
    const temporaryType = await getColumnType(tableName, 'nameJson');

    if (nameType === 'json' && temporaryType === null) {
        console.log('Skipped: the name column of ' + tableName + ' is already json.');
        return;
    }

    if (temporaryType === null) {
        await Database.statement(`ALTER TABLE ${escapedTable} ADD COLUMN \`nameJson\` json NULL AFTER \`typeId\``);
    }

    if (nameType !== null && nameType !== 'json') {
        await Database.statement(`UPDATE ${escapedTable} SET \`nameJson\` = JSON_OBJECT('value', \`name\`, 'version', 0) WHERE \`nameJson\` IS NULL`);
        await Database.statement(`ALTER TABLE ${escapedTable} DROP COLUMN \`name\``);
    }

    await Database.statement(`ALTER TABLE ${escapedTable} CHANGE COLUMN \`nameJson\` \`name\` json NOT NULL`);
}

export default new Migration(async () => {
    process.stdout.write('\n');
    console.log('Start converting event names to json.');
    await convertEventNameToJson();
});
