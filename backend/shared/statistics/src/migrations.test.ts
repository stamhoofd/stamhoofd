import { Database } from '@simonbackx/simple-database';
import { TestUtils } from '@stamhoofd/test-utils';
import { getStatisticsDatabase } from './migrations.js';

/**
 * Column names that would mean a natural person ended up in the statistics database. This guards
 * every table in it, not only the ones the first migration created: the database is handed to
 * reporting tools that must never reach the main database.
 *
 * `birthDay` is on the list while `birthYear` is not, which is exactly the distinction that keeps
 * age distributions possible without storing a date of birth.
 */
const personalDataColumns = [
    'firstname',
    'lastname',
    'birthday',
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

describe('getStatisticsDatabase', () => {
    it('refuses to migrate the main database, whose tables it would collide with', () => {
        TestUtils.setEnvironment('DB_STATISTICS_DATABASE', STAMHOOFD.DB_DATABASE);

        expect(() => getStatisticsDatabase()).toThrow('has to be a separate one');
    });

    it('refuses to run when no statistics database is configured', () => {
        TestUtils.setEnvironment('DB_STATISTICS_DATABASE', undefined);

        expect(() => getStatisticsDatabase()).toThrow('is not set');
    });
});

describe('migration.platform-statistics-schema', () => {
    async function getColumns(): Promise<{ tableName: string; columnName: string; dataType: string }[]> {
        const [rows] = await Database.select(
            'SELECT TABLE_NAME as tableName, COLUMN_NAME as columnName, COLUMN_TYPE as dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?',
            [getStatisticsDatabase()],
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

    it('mirrors the column types of the main database', async () => {
        const columns = await getColumns();
        const typeOf = (tableName: string, columnName: string) => columns.find(column => column.tableName === tableName && column.columnName === columnName)?.dataType;

        expect(typeOf('members', 'id')).toBe('varchar(36)');
        expect(typeOf('registrations', 'memberId')).toBe('varchar(36)');
        expect(typeOf('registrations', 'waitingList')).toBe('tinyint(1)');
        expect(typeOf('registrations', 'cycle')).toBe('int');
        expect(typeOf('registrations', 'registeredAt')).toBe('datetime');
        expect(typeOf('organizations', 'name')).toBe('varchar(100)');
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
            const name = column.columnName.toLowerCase();
            return personalDataColumns.some(forbidden => name.includes(forbidden));
        });

        expect(offending).toEqual([]);
    });
});
