import { getStatisticsConnection, getStatisticsDatabaseConfig } from './database.js';
import { neverDeletedTables } from './sync.js';

/**
 * Column names that would mean a natural person ended up in the statistics database. This guards
 * every table in it, not only the ones the first migration created: the database is handed to
 * reporting tools that must never reach the main database.
 */
const personalDataColumns = [
    'firstname',
    'lastname',
    'birthday',
    'birthdate',
    'dateofbirth',
    'email',
    'phone',
    'address',
    'street',
    'postalcode',
    'nationalregister',
    'securitycode',
    'membernumber',
    'details',
    'recordanswers',
];

/**
 * Deliberate exceptions to the list above, as `table.column`.
 *
 * An organization is a legal entity, so where it is located is not personal data. A member's date of
 * birth and postal code are, and are here because the report charts members by age and maps them by
 * postal code. They are listed per table rather than removed from the list, so the same column
 * appearing on a third table still fails.
 */
const allowedPersonalDataColumns = new Set([
    'organizations.postalCode',
    'members.postalCode',
    'members.birthDate',
    // The lookup of where a postal code is. It describes an area, not anyone living in it.
    'postal_codes.postalCode',
]);

describe('migration.platform-statistics-schema', () => {
    async function getColumns(): Promise<{ tableName: string; columnName: string; dataType: string }[]> {
        const [rows] = await getStatisticsConnection().select(
            'SELECT TABLE_NAME as tableName, COLUMN_NAME as columnName, COLUMN_TYPE as dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?',
            [getStatisticsDatabaseConfig().DB_DATABASE],
            { nestTables: false },
        );
        return rows as unknown as { tableName: string; columnName: string; dataType: string }[];
    }

    it('creates every table the member reports read from', async () => {
        const tables = new Set((await getColumns()).map(column => column.tableName));

        expect([...tables].sort()).toEqual([
            '_organizations_organization_tags',
            'default_age_groups',
            'groups',
            'member_platform_memberships',
            'member_responsibility_records',
            'members',
            'migrations',
            'organization_tags',
            'organizations',
            'platform_membership_types',
            'postal_codes',
            'registration_periods',
            'registrations',
            'responsibilities',
            'stats_sync_state',
        ]);
    });

    it('keeps members and registrations at their source grain, so a member can hold several registrations', async () => {
        const columns = await getColumns();
        const registrations = columns.filter(column => column.tableName === 'registrations').map(column => column.columnName);

        expect(registrations).toContain('memberId');
        expect(registrations).toContain('groupId');
        expect(columns.filter(column => column.tableName === 'members').map(column => column.columnName)).toContain('id');

        // Nothing is pre-aggregated: no counts are stored, every figure is computed at query time.
        expect(columns.filter(column => /count$/i.test(column.columnName))).toEqual([]);
    });

    /**
     * A member's gender, birth date and postal code all change over their life, so a row describes
     * them in one year rather than as they are now. The period is part of the key, which is also what
     * lets the sync leave a settled year alone.
     */
    it('keeps a member row per period, so a settled year holds the member as it counted them', async () => {
        const [rows] = await getStatisticsConnection().select(
            'SELECT COLUMN_NAME as columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX',
            [getStatisticsDatabaseConfig().DB_DATABASE, 'members', 'PRIMARY'],
            { nestTables: false },
        );

        expect((rows as unknown as { columnName: string }[]).map(row => row.columnName)).toEqual(['id', 'periodId']);
    });

    /**
     * The delete reconciliation walks a table by id and asks the source which ids are still there. A
     * table holding several rows per id has no way to say which of them a surviving id stands for,
     * so it must be one the sync never deletes from.
     */
    it('never deletes from a table that holds more than one row per id', async () => {
        const [rows] = await getStatisticsConnection().select(
            'SELECT TABLE_NAME as tableName, COUNT(*) as columns FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND INDEX_NAME = ? GROUP BY TABLE_NAME HAVING COUNT(*) > 1',
            [getStatisticsDatabaseConfig().DB_DATABASE, 'PRIMARY'],
            { nestTables: false },
        );
        const composite = (rows as unknown as { tableName: string }[]).map(row => row.tableName).sort();

        expect(composite).toEqual(['members']);
        expect(neverDeletedTables()).toContain('members');
    });

    it('mirrors the column types of the main database', async () => {
        const columns = await getColumns();
        const typeOf = (tableName: string, columnName: string) => columns.find(column => column.tableName === tableName && column.columnName === columnName)?.dataType;

        expect(typeOf('members', 'id')).toBe('varchar(36)');
        expect(typeOf('registrations', 'memberId')).toBe('varchar(36)');
        expect(typeOf('registrations', 'waitingList')).toBe('tinyint(1)');
        expect(typeOf('registrations', 'cycle')).toBe('int');
        expect(typeOf('registrations', 'registeredAt')).toBe('datetime');
        expect(typeOf('organizations', 'name')).toBe('varchar(100)');
        expect(typeOf('organizations', 'postalCode')).toBe('varchar(36)');
        expect(typeOf('organizations', 'city')).toBe('varchar(100)');
        expect(typeOf('members', 'postalCode')).toBe('varchar(36)');
        expect(typeOf('members', 'birthDate')).toBe('date');
        expect(typeOf('registration_periods', 'cutoffAt')).toBe('datetime');
        // Both replaced by the per-period cutoff: a settled year is protected by freezing it, not by
        // a validity window on every row.
        expect(typeOf('members', 'includeSince')).toBeUndefined();
        expect(typeOf('members', 'excludeSince')).toBeUndefined();
        // Netwerk membership is a fact of a period, so a settled year keeps the one it was recorded with.
        expect(typeOf('_organizations_organization_tags', 'periodId')).toBe('varchar(36)');
    });

    it('holds no personally identifiable information in any table', async () => {
        const offending = (await getColumns()).filter((column) => {
            if (allowedPersonalDataColumns.has(`${column.tableName}.${column.columnName}`)) {
                return false;
            }
            const name = column.columnName.toLowerCase();
            return personalDataColumns.some(forbidden => name.includes(forbidden));
        });

        expect(offending).toEqual([]);
    });
});

describe('migration.postal-code-coordinates', () => {
    async function getPostalCodes(): Promise<{ postalCode: string; latitude: number; longitude: number }[]> {
        // Its own connection: the main database has a `postal_codes` table of its own, which is what
        // the shared one would reach.
        const [rows] = await getStatisticsConnection().select(
            'SELECT `postalCode`, `latitude` + 0E0 AS `latitude`, `longitude` + 0E0 AS `longitude` FROM `postal_codes`',
            [],
            { nestTables: false },
        );
        return rows as unknown as { postalCode: string; latitude: number; longitude: number }[];
    }

    it('loads a point for every Belgian postal code', async () => {
        const rows = await getPostalCodes();

        // Belgian postal codes run from 1000 to 9992. A handful are missing from any published list
        // and the count shifts when bpost adds one, so this only guards against a partly loaded table.
        expect(rows.length).toBeGreaterThan(1100);
        expect(rows.every(row => /^\d{4}$/.test(row.postalCode))).toBe(true);
        expect(new Set(rows.map(row => row.postalCode)).size).toBe(rows.length);
    });

    it('places every point inside Belgium', async () => {
        const outside = (await getPostalCodes()).filter(row =>
            row.latitude < 49.4 || row.latitude > 51.6 || row.longitude < 2.5 || row.longitude > 6.5);

        expect(outside).toEqual([]);
    });

    it('puts the largest cities where they belong', async () => {
        const byPostalCode = new Map((await getPostalCodes()).map(row => [row.postalCode, row]));

        // Kilometres between the loaded point and where the city actually is. A postal code covers an
        // area, so its centre is only ever near the city, not on it.
        function distanceTo(postalCode: string, latitude: number, longitude: number): number {
            const row = byPostalCode.get(postalCode);
            if (!row) {
                throw new Error(`Postal code ${postalCode} was not loaded`);
            }
            const north = (row.latitude - latitude) * 111;
            const east = (row.longitude - longitude) * 111 * Math.cos((latitude * Math.PI) / 180);
            return Math.sqrt(north * north + east * east);
        }

        expect(distanceTo('1000', 50.85, 4.35)).toBeLessThan(5);
        expect(distanceTo('2000', 51.22, 4.40)).toBeLessThan(5);
        expect(distanceTo('9000', 51.05, 3.72)).toBeLessThan(5);
        expect(distanceTo('8000', 51.21, 3.22)).toBeLessThan(5);
        expect(distanceTo('3500', 50.93, 5.34)).toBeLessThan(5);
        expect(distanceTo('4000', 50.63, 5.57)).toBeLessThan(5);
        expect(distanceTo('5000', 50.46, 4.87)).toBeLessThan(5);
        expect(distanceTo('6000', 50.41, 4.44)).toBeLessThan(5);
    });
});
