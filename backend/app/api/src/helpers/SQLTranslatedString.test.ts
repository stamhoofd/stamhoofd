import { Database } from '@node/database';
import { I18n } from '@stamhoofd/backend-i18n';
import type { NormalizedSQLQuery, SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, compileToSQLFilter, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { SQLTranslatedString } from './SQLTranslatedString.js';

type TranslatedStringValue = string | { [key in Language]?: string };
type Row = { settings: { name: TranslatedStringValue } };

const filters: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    'settings:name': createColumnFilter({
        expression: new SQLTranslatedString(SQL.column('settings'), '$.name'),
        type: SQLValueType.String,
        nullable: true,
    }),
};

/**
 * Creates a table with a single nullable json `settings` column, inserts the rows and checks that every
 * `doMatch` filter returns all rows and every `doNotMatch` filter returns none, with `$getLanguage()`
 * resolving to `language`. Snapshots the queries.
 */
async function testMatch({ language, rows, doMatch = [], doNotMatch = [] }: { language: Language; rows: Row[]; doMatch?: StamhoofdFilter[]; doNotMatch?: StamhoofdFilter[] }) {
    const tableName = 'test_translated_string_' + Math.random().toString(36).substring(2, 15);
    await Database.statement(`CREATE TABLE \`${tableName}\` (\`settings\` json) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`);

    try {
        for (const row of rows) {
            await Database.insert('INSERT INTO `' + tableName + '` SET ?', [{ settings: JSON.stringify(row.settings) }]);
        }

        await I18n.runWithLocale(new I18n(language, Country.Belgium), async () => {
            for (const [filterList, expectedCount, label] of [[doMatch, rows.length, 'filter'], [doNotMatch, 0, 'not match filter']] as const) {
                for (const filter of filterList) {
                    const select = SQL.select().from(tableName).where(await compileToSQLFilter(filter, filters));
                    const results = await select.fetch();
                    expect(results, `${label} ${JSON.stringify(filter)}`).toHaveLength(expectedCount);

                    const query = select.getSQL() as NormalizedSQLQuery;
                    expect({
                        query: query.query.replaceAll('`' + tableName + '`', '`test_table`'),
                        params: query.params,
                    }).toMatchSnapshot('SQL Query for ' + label + ': ' + JSON.stringify(filter));
                }
            }
        });
    }
    finally {
        await Database.statement(`DROP TABLE IF EXISTS \`${tableName}\``);
    }
}

describe('SQLTranslatedString', () => {
    beforeEach(() => {
        // The test env has no locales configured, and I18n coerces the language to one that is valid for the country
        TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.English, Language.French] });
    });

    it('Comparing string values is case insensitive', async () => {
        await testMatch({
            language: Language.Dutch,
            rows: [
                { settings: { name: { nl: 'alice', en: 'alice', fr: 'alice' } } },
                { settings: { name: { nl: 'Alice', en: 'Alice', fr: 'Alice' } } },
                { settings: { name: { nl: 'ALICE', en: 'ALICE', fr: 'ALICE' } } },
            ],
            doMatch: [
                { 'settings:name': 'alice' },
                { 'settings:name': 'Alice' },
                { 'settings:name': 'ALICE' },
                { 'settings:name': 'alICe' },
            ],
            doNotMatch: [
                { 'settings:name': 'b' },
                { 'settings:name': 'alic' },
            ],
        });
    });

    it('Filter matches both string and TranslatedString value', async () => {
        await testMatch({
            language: Language.Dutch,
            rows: [
                { settings: { name: { nl: 'alice', en: 'alice', fr: 'alice' } } },
                { settings: { name: 'alice' } },
                { settings: { name: 'ALICE' } },
                { settings: { name: 'aliCE' } },
            ],
            doMatch: [
                { 'settings:name': 'alice' },
                { 'settings:name': 'Alice' },
                { 'settings:name': 'ALICE' },
                { 'settings:name': 'alICe' },
            ],
            doNotMatch: [
                { 'settings:name': 'b' },
                { 'settings:name': 'alic' },
            ],
        });
    });

    it('Filter on gt, gte, lt and lte works', async () => {
        await testMatch({
            language: Language.Dutch,
            rows: [
                { settings: { name: { nl: 'test b', en: 'test c', fr: 'test a' } } },
                { settings: { name: 'test b' } },
            ],
            doMatch: [
                { 'settings:name': { $lt: 'test c' } },
                { 'settings:name': { $gt: 'test a' } },
                { 'settings:name': { $gte: 'test b' } },
                { 'settings:name': { $lte: 'test b' } },
            ],
            doNotMatch: [
                { 'settings:name': { $gt: 'test b' } },
                { 'settings:name': { $gt: 'test c' } },
                { 'settings:name': { $gte: 'test c' } },
                { 'settings:name': { $lt: 'test b' } },
                { 'settings:name': { $lt: 'test a' } },
                { 'settings:name': { $lte: 'test a' } },
            ],
        });
    });

    describe('Selects the value of the current language for comparison', () => {
        it('NL', async () => {
            await testMatch({
                language: Language.Dutch,
                rows: [
                    { settings: { name: { nl: 'juist', en: 'fout', fr: 'fout' } } },
                    { settings: { name: 'juist' } },
                ],
                doMatch: [{ 'settings:name': 'juist' }],
                doNotMatch: [{ 'settings:name': 'fout' }],
            });
        });

        it('EN', async () => {
            await testMatch({
                language: Language.English,
                rows: [
                    { settings: { name: { nl: 'fout', en: 'juist', fr: 'fout' } } },
                    { settings: { name: 'juist' } },
                ],
                doMatch: [{ 'settings:name': 'juist' }],
                doNotMatch: [{ 'settings:name': 'fout' }],
            });
        });

        it('FR', async () => {
            await testMatch({
                language: Language.French,
                rows: [
                    { settings: { name: { nl: 'fout', en: 'fout', fr: 'juist' } } },
                    { settings: { name: 'juist' } },
                ],
                doMatch: [{ 'settings:name': 'juist' }],
                doNotMatch: [{ 'settings:name': 'fout' }],
            });
        });
    });

    describe('Falls back to the next language in order (en, nl, fr) when the current language is missing', () => {
        it('NL', async () => {
            await testMatch({
                language: Language.Dutch,
                rows: [
                    { settings: { name: { en: 'juist', fr: 'fout' } } },
                    { settings: { name: { fr: 'juist' } } },
                ],
                doMatch: [{ 'settings:name': 'juist' }],
                doNotMatch: [{ 'settings:name': 'fout' }],
            });
        });

        it('EN', async () => {
            await testMatch({
                language: Language.English,
                rows: [
                    { settings: { name: { fr: 'fout', nl: 'juist' } } },
                    { settings: { name: { fr: 'juist' } } },
                ],
                doMatch: [{ 'settings:name': 'juist' }],
                doNotMatch: [{ 'settings:name': 'fout' }],
            });
        });

        it('FR', async () => {
            await testMatch({
                language: Language.French,
                rows: [
                    { settings: { name: { nl: 'fout', en: 'juist' } } },
                    { settings: { name: { nl: 'juist' } } },
                ],
                doMatch: [{ 'settings:name': 'juist' }],
                doNotMatch: [{ 'settings:name': 'fout' }],
            });
        });
    });

    it('Empty json value should not match filter', async () => {
        await testMatch({
            language: Language.Dutch,
            rows: [
                { settings: { name: {} } },
            ],
            doNotMatch: [
                { 'settings:name': '' },
                { 'settings:name': 'test' },
            ],
        });
    });
});
