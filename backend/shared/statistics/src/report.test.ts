import { getStatisticsConnection } from './connection.js';
import type { ReportCard, ReportTab } from './report.js';
import { loadReport, parameterNames, parseTab, resolveSql } from './report.js';

/**
 * The years this test works in. Deliberately later than any other suite's periods, and adjacent to
 * each other: the retention figures read the previous scoutsjaar off the years that have members
 * ordered by date, and this package's suites share one database that is never emptied between runs.
 * Sitting last also means the second year has no year after it, which is exactly the year the
 * retention figures have to keep reporting on.
 */
const firstYear = 'Testjaar 2090 - 2091';
const secondYear = 'Testjaar 2091 - 2092';
const unit = '1e Rapporttest';

/**
 * A year in the shape the import leaves behind, before `firstYear` and at a unit of its own so the
 * other figures do not move. Being the year before `firstYear` makes it what `firstYear`'s retention
 * is measured against.
 */
const importedYear = 'Testjaar 2089 - 2090';
const importedUnit = '3e Rapporttest';

/** A period nobody is registered in, between two years that do have members. */
const emptyYear = 'Testjaar zonder leden';

async function run(card: ReportCard, values: Record<string, string | null> = {}): Promise<Record<string, any>[]> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(resolveSql(card.sql, values), [], { nestTables: false });
    return rows as unknown as Record<string, any>[];
}

/**
 * Tables that record which pipeline wrote a row. These rows are marked as imported, which is what
 * they are: they have no counterpart in the main database, so the delete reconciliation of the sync
 * has to leave them alone. Without that it tries to remove them and trips over their foreign keys.
 */
const tablesWithSource = new Set(['registration_periods', 'organizations', '_organizations_organization_tags', 'groups', 'members', 'registrations', 'member_platform_memberships']);

async function insert(table: string, rows: Record<string, unknown>[]): Promise<void> {
    const connection = getStatisticsConnection();
    if (tablesWithSource.has(table)) {
        rows = rows.map(row => ({ ...row, source: 'import' }));
    }
    const columns = Object.keys(rows[0]);
    await connection.insert(
        `INSERT INTO ${connection.escapeId(table)} (${columns.map(column => connection.escapeId(column)).join(', ')}) VALUES ?`,
        [rows.map(row => columns.map(column => row[column] ?? null))],
    );
}

function cardOf(tabs: ReportTab[], tab: string, card: string): ReportCard {
    const found = tabs.find(entry => entry.key === tab)?.cards.find(entry => entry.key === card);
    if (!found) {
        throw new Error(`No card ${tab}/${card}`);
    }
    return found;
}

/**
 * Every row this test writes carries an `rt-` id, so it can clear its own and leave the rest of the
 * database alone. The test database keeps its data between runs, so seeding has to be repeatable.
 */
async function clean(): Promise<void> {
    const connection = getStatisticsConnection();
    const byId = ['member_platform_memberships', 'member_responsibility_records', 'registrations', 'groups', 'members', 'organizations', 'registration_periods', 'default_age_groups', 'organization_tags', 'platform_membership_types'];

    await connection.delete('DELETE FROM `_organizations_organization_tags` WHERE `organizationsId` LIKE \'rt-%\'', []);
    for (const table of byId) {
        await connection.delete(`DELETE FROM ${connection.escapeId(table)} WHERE \`id\` LIKE 'rt-%'`, []);
    }
}

/**
 * A unit with three children, one leiding and one volwassene in the first year, of whom the three
 * children come back in the second. Small enough that every figure below can be checked by hand.
 */
async function seed(): Promise<void> {
    const now = new Date();
    await insert('registration_periods', [
        { id: 'rt-p0', startDate: new Date(Date.UTC(2089, 8, 1)), endDate: new Date(Date.UTC(2090, 7, 31)), name: importedYear, customName: importedYear, createdAt: now, updatedAt: now },
        { id: 'rt-p-leeg', startDate: new Date(Date.UTC(2090, 1, 1)), endDate: new Date(Date.UTC(2090, 7, 31)), name: emptyYear, customName: emptyYear, createdAt: now, updatedAt: now },
        { id: 'rt-p1', startDate: new Date(Date.UTC(2090, 8, 1)), endDate: new Date(Date.UTC(2091, 7, 31)), name: firstYear, customName: firstYear, createdAt: now, updatedAt: now },
        { id: 'rt-p2', startDate: new Date(Date.UTC(2091, 8, 1)), endDate: new Date(Date.UTC(2092, 7, 31)), name: secondYear, customName: secondYear, createdAt: now, updatedAt: now },
    ]);

    await insert('default_age_groups', [
        { id: 'rt-ag-bevers', name: 'Bevers', minAge: 5, maxAge: 7, category: 'child' },
        { id: 'rt-ag-verkenners', name: 'Verkenners', minAge: 14, maxAge: 15, category: 'child' },
        { id: 'rt-ag-leiding', name: 'Leiding', minAge: null, maxAge: null, category: 'leader' },
        { id: 'rt-ag-stam', name: 'Stam', minAge: null, maxAge: null, category: 'adult' },
    ]);

    await insert('organizations', [
        { id: 'rt-org-a', name: unit, uri: 'rt-org-a', postalCode: '9000', city: 'Gent', periodId: 'rt-p1', active: 1, createdAt: now, updatedAt: now },
        { id: 'rt-org-b', name: '2e Rapporttest', uri: 'rt-org-b', postalCode: '8000', city: 'Brugge', periodId: 'rt-p1', active: 1, createdAt: now, updatedAt: now },
        { id: 'rt-org-c', name: importedUnit, uri: 'rt-org-c', postalCode: '2000', city: 'Antwerpen', periodId: 'rt-p0', active: 1, createdAt: now, updatedAt: now },
    ]);

    await insert('organization_tags', [
        { id: 'rt-tag-oost', name: 'Oost-Vlaanderen' },
        { id: 'rt-tag-west', name: 'West-Vlaanderen' },
    ]);
    await insert('_organizations_organization_tags', [
        { organizationsId: 'rt-org-a', organizationTagsId: 'rt-tag-oost', periodId: 'rt-p1' },
        { organizationsId: 'rt-org-b', organizationTagsId: 'rt-tag-west', periodId: 'rt-p1' },
    ]);

    const groups = [
        { id: 'rt-g-a-bevers-p1', ageGroup: 'rt-ag-bevers', organizationId: 'rt-org-a', periodId: 'rt-p1', name: 'Bevers' },
        { id: 'rt-g-a-verk-p1', ageGroup: 'rt-ag-verkenners', organizationId: 'rt-org-a', periodId: 'rt-p1', name: 'Verkenners' },
        { id: 'rt-g-a-leiding-p1', ageGroup: 'rt-ag-leiding', organizationId: 'rt-org-a', periodId: 'rt-p1', name: 'Leiding' },
        { id: 'rt-g-a-stam-p1', ageGroup: 'rt-ag-stam', organizationId: 'rt-org-a', periodId: 'rt-p1', name: 'Stam' },
        { id: 'rt-g-a-bevers-p2', ageGroup: 'rt-ag-bevers', organizationId: 'rt-org-a', periodId: 'rt-p2', name: 'Bevers' },
        { id: 'rt-g-a-verk-p2', ageGroup: 'rt-ag-verkenners', organizationId: 'rt-org-a', periodId: 'rt-p2', name: 'Verkenners' },
        { id: 'rt-g-b-bevers-p1', ageGroup: 'rt-ag-bevers', organizationId: 'rt-org-b', periodId: 'rt-p1', name: 'Bevers' },
    ];
    await insert('groups', groups.map(group => ({
        id: group.id, type: 'Membership', name: group.name, organizationId: group.organizationId,
        periodId: group.periodId, defaultAgeGroupId: group.ageGroup, cycle: 0, status: 'Open',
        deletedAt: null, createdAt: now, updatedAt: now,
    })));

    // What the import leaves for the years it brought in: one tak per unit per year, with no name and
    // no age group, holding the members whose real tak it did not record.
    await insert('groups', [{
        id: 'rt-g-c-import-p0', type: 'Membership', name: '', organizationId: 'rt-org-c',
        periodId: 'rt-p0', defaultAgeGroupId: null, cycle: 0, status: 'Open',
        deletedAt: null, createdAt: now, updatedAt: now,
    }]);

    const members = [
        { id: 'rt-m1', birthDate: '1984-06-01', gender: 'Male', postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m2', birthDate: '1984-07-01', gender: 'Female', postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m3', birthDate: '1975-01-01', gender: 'Male', postalCode: '9030', organizationId: 'rt-org-a' },
        { id: 'rt-m4', birthDate: '1968-01-01', gender: 'Female', postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m5', birthDate: '1950-01-01', gender: null, postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m6', birthDate: '1984-02-01', gender: 'Male', postalCode: '8000', organizationId: 'rt-org-b' },
        // In the imported tak: a child by age, and someone too old to place without a tak.
        { id: 'rt-m7', birthDate: '2080-01-01', gender: 'Male', postalCode: '2000', organizationId: 'rt-org-c' },
        { id: 'rt-m8', birthDate: '2060-01-01', gender: 'Female', postalCode: '2000', organizationId: 'rt-org-c' },
    ];
    await insert('members', members.map(member => ({ ...member, createdAt: now, updatedAt: now, lastRegisteredAt: null })));

    const registrations = [
        { id: 'rt-r1', memberId: 'rt-m1', groupId: 'rt-g-a-bevers-p1', organizationId: 'rt-org-a', periodId: 'rt-p1' },
        { id: 'rt-r2', memberId: 'rt-m2', groupId: 'rt-g-a-bevers-p1', organizationId: 'rt-org-a', periodId: 'rt-p1' },
        { id: 'rt-r3', memberId: 'rt-m3', groupId: 'rt-g-a-verk-p1', organizationId: 'rt-org-a', periodId: 'rt-p1' },
        { id: 'rt-r4', memberId: 'rt-m4', groupId: 'rt-g-a-leiding-p1', organizationId: 'rt-org-a', periodId: 'rt-p1' },
        { id: 'rt-r5', memberId: 'rt-m5', groupId: 'rt-g-a-stam-p1', organizationId: 'rt-org-a', periodId: 'rt-p1' },
        { id: 'rt-r6', memberId: 'rt-m6', groupId: 'rt-g-b-bevers-p1', organizationId: 'rt-org-b', periodId: 'rt-p1' },
        // The three children come back the year after; the leiding and the volwassene do not.
        { id: 'rt-r7', memberId: 'rt-m1', groupId: 'rt-g-a-bevers-p2', organizationId: 'rt-org-a', periodId: 'rt-p2' },
        { id: 'rt-r8', memberId: 'rt-m2', groupId: 'rt-g-a-bevers-p2', organizationId: 'rt-org-a', periodId: 'rt-p2' },
        { id: 'rt-r9', memberId: 'rt-m3', groupId: 'rt-g-a-verk-p2', organizationId: 'rt-org-a', periodId: 'rt-p2' },
        // The unit-B bever moves to unit A: still a blijver, which is how the client counts it.
        { id: 'rt-r10', memberId: 'rt-m6', groupId: 'rt-g-a-bevers-p2', organizationId: 'rt-org-a', periodId: 'rt-p2' },
    ];
    await insert('registrations', registrations.map(registration => ({
        ...registration, registeredAt: new Date(Date.UTC(2090, 8, 15)), startDate: null, endDate: null,
        trialUntil: null, deactivatedAt: null, waitingList: 0, cycle: 0, createdAt: now, updatedAt: now,
    })));

    await insert('registrations', [
        { id: 'rt-r11', memberId: 'rt-m7', groupId: 'rt-g-c-import-p0', organizationId: 'rt-org-c', periodId: 'rt-p0' },
        { id: 'rt-r12', memberId: 'rt-m8', groupId: 'rt-g-c-import-p0', organizationId: 'rt-org-c', periodId: 'rt-p0' },
    ].map(registration => ({
        ...registration, registeredAt: new Date(Date.UTC(2089, 8, 15)), startDate: null, endDate: null,
        trialUntil: null, deactivatedAt: null, waitingList: 0, cycle: 0, createdAt: now, updatedAt: now,
    })));

    await insert('platform_membership_types', [{ id: 'rt-mt-normal', name: 'Normal' }]);
    await insert('member_platform_memberships', members.slice(0, 5).map((member, index) => ({
        id: `rt-mpm-${index}`, memberId: member.id, membershipTypeId: 'rt-mt-normal', organizationId: 'rt-org-a',
        periodId: 'rt-p1', startDate: new Date(Date.UTC(2090, 8, 1)), endDate: new Date(Date.UTC(2091, 7, 31)),
        expireDate: null, trialUntil: null, deletedAt: null, createdAt: now, updatedAt: now,
    })));
}

describe('report', () => {
    let dashboards: ReportTab[];

    beforeAll(async () => {
        dashboards = await loadReport();
        await clean();
        await seed();
    });

    describe('definition', () => {
        it('has the four pages of the report as tabs, plus the filter values', () => {
            expect(dashboards.map(dashboard => dashboard.key)).toEqual(['nationaal', 'eenheden', 'netwerk', 'varia', 'filters']);
            expect(dashboards.find(tab => tab.key === 'filters')!.hidden).toBe(true);
        });

        it('reads a card with its metadata and expands the shared fragments', () => {
            const card = cardOf(dashboards, 'nationaal', 'totaal-leden');

            expect(card.title).toEqual('Totaal leden');
            expect(card.display).toEqual('scalar');
            expect(card.sql).toContain('WITH facts AS');
            expect(card.sql).not.toContain('@include');
        });

        /**
         * A dashboard only connects the filters it shows, so a card offering one it does not have is
         * harmless. A card missing one it needs is not, and neither is a trend card that the year
         * filter can reach: it would collapse to the single year the filter selected.
         */
        it('takes the parameters a card uses from its sql, so the two cannot drift', () => {
            expect(cardOf(dashboards, 'nationaal', 'totaal-leden').parameters).toContain('scoutsjaar');
            expect(cardOf(dashboards, 'eenheden', 'eenheid-totaal-leden').parameters).toEqual(['scoutsjaar', 'eenheid']);

            for (const key of ['leden-per-scoutsjaar', 'percentage-blijvers-per-eenheid']) {
                expect(`${key}: ${cardOf(dashboards, 'nationaal', key).sql.includes('p.name = {{scoutsjaar}}')}`).toEqual(`${key}: false`);
            }
        });

        it('names every column a chart plots', () => {
            for (const dashboard of dashboards) {
                for (const card of dashboard.cards.filter(card => ['bar', 'line', 'combo', 'pie', 'map'].includes(card.display))) {
                    expect(`${card.key}: ${card.dimensions.length}`).not.toEqual(`${card.key}: 0`);
                    expect(`${card.key}: ${card.metrics.length}`).not.toEqual(`${card.key}: 0`);

                    for (const column of [...card.dimensions, ...card.metrics]) {
                        expect(`${card.key} selects ${column}`).toEqual(card.sql.includes(`\`${column}\``) ? `${card.key} selects ${column}` : `${card.key} does not select ${column}`);
                    }
                }
            }
        });

        it('gives the unit filter to the eenheden tab only, as the report does', () => {
            expect(dashboards.find(dashboard => dashboard.key === 'eenheden')!.filters).toEqual(['scoutsjaar', 'eenheid']);

            for (const key of ['nationaal', 'netwerk', 'varia']) {
                expect(`${key}: ${dashboards.find(dashboard => dashboard.key === key)!.filters.join(',')}`).toEqual(`${key}: scoutsjaar`);
            }
        });

        /**
         * A chart with a bar per eenheid has more labels than fit, and Metabase drops them all
         * rather than rotate on its own. The charts that need them say so.
         */
        it('reads how a card wants its x-axis labels drawn', () => {
            expect(cardOf(dashboards, 'nationaal', 'leden-per-eenheid').xLabels).toEqual('rotate-45');
            expect(cardOf(dashboards, 'nationaal', 'leden-per-tak-vergelijking').xLabels).toEqual('rotate-45');
            expect(cardOf(dashboards, 'nationaal', 'percentage-blijvers-per-eenheid').xLabels).toEqual('rotate-45');
            expect(cardOf(dashboards, 'nationaal', 'leden-per-geboortejaar').xLabels).toBeUndefined();
        });

        it('rejects an x-axis setting it cannot pass on', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: bar\n-- xlabels: sideways\nSELECT 1', 'x.sql', new Map()))
                .toThrow('has xlabels "sideways"');
        });

        it('rejects a filter no card can be driven by', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n-- filters: eenheid\n\n-- @card c\n-- title: C\n-- display: table\nSELECT 1', 'x.sql', new Map()))
                .toThrow('no card uses {{eenheid}}');
        });

        it('rejects a card without a title', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- display: table\nSELECT 1', 'x.sql', new Map()))
                .toThrow('"c" has no title');
        });

        it('rejects an include that does not exist', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: table\n-- @include nope\nSELECT 1', 'x.sql', new Map()))
                .toThrow('report/includes/nope.sql');
        });
    });

    describe('resolveSql', () => {
        it('keeps an optional clause when its parameter has a value', () => {
            expect(resolveSql('SELECT 1 [[AND name = {{scoutsjaar}}]]', { scoutsjaar: '2024 - 2025' })).toEqual("SELECT 1 AND name = '2024 - 2025'");
        });

        it('drops an optional clause when it has none, which is what Metabase does', () => {
            expect(resolveSql('SELECT 1 [[AND name = {{scoutsjaar}}]]', {})).toEqual('SELECT 1 ');
        });

        it('escapes a quote rather than ending the string', () => {
            expect(resolveSql('{{eenheid}}', { eenheid: "'t Vloedgat" })).toEqual("'''t Vloedgat'");
        });

        it('finds each parameter once, in the order it appears', () => {
            expect(parameterNames('{{b}} {{a}} {{b}}')).toEqual(['b', 'a']);
        });
    });

    /**
     * The point of keeping the queries in this package: a column that is renamed or dropped in the
     * migration breaks here rather than in Metabase.
     */
    describe('every card runs against the real schema', () => {
        it('runs with both filters set', async () => {
            const ran: string[] = [];
            for (const dashboard of dashboards) {
                for (const card of dashboard.cards) {
                    await run(card, { scoutsjaar: firstYear, eenheid: unit });
                    ran.push(card.key);
                }
            }

            expect(ran.length).toEqual(dashboards.reduce((total, dashboard) => total + dashboard.cards.length, 0));
        });

        it('runs with no filter selected', async () => {
            const ran: string[] = [];
            for (const dashboard of dashboards) {
                for (const card of dashboard.cards) {
                    await run(card, {});
                    ran.push(card.key);
                }
            }

            expect(ran.length).toBeGreaterThan(40);
        });
    });

    describe('the figures the report leads with', () => {
        it('counts members, units and the three categories', async () => {
            const values = { scoutsjaar: firstYear };

            expect((await run(cardOf(dashboards, 'nationaal', 'aantal-eenheden'), values))[0]['Aantal eenheden']).toEqual(2);
            expect((await run(cardOf(dashboards, 'nationaal', 'totaal-leden'), values))[0]['Totaal leden']).toEqual(6);
            expect((await run(cardOf(dashboards, 'nationaal', 'aantal-kinderen'), values))[0]['Aantal kinderen']).toEqual(4);
            expect((await run(cardOf(dashboards, 'nationaal', 'aantal-leiding'), values))[0]['Aantal leiding']).toEqual(1);
            expect((await run(cardOf(dashboards, 'nationaal', 'aantal-volwassenen'), values))[0]['Aantal volwassenen']).toEqual(1);
        });

        it('divides kinderen by leiding for the omkaderingscijfer', async () => {
            const rows = await run(cardOf(dashboards, 'eenheden', 'eenheid-omkaderingscijfer'), { scoutsjaar: firstYear, eenheid: unit });

            expect(Number(rows[0]['Omkaderingscijfer'])).toEqual(3);
        });

        /**
         * The chosen scoutsjaar is the year the figure describes: how many of the year before are
         * still there. The newest year is the one the report is read for, so it has to be answered
         * even though no year follows it.
         */
        it('counts a member who comes back as a blijver of the year they come back in', async () => {
            const rows = await run(cardOf(dashboards, 'nationaal', 'percentage-blijvers-per-eenheid'), { scoutsjaar: secondYear });
            const row = rows.find(row => row['Eenheid'] === unit);

            // Three of the five members the unit had the year before return.
            expect(Number(row!['Percentage blijvers'])).toEqual(60);
        });

        /**
         * The client's own figures for 9e Wandelaar only line up this way: counting only the members
         * who stay at the same unit gives 37, 51 and 45 blijvers where their report says 38, 54, 46.
         */
        it('still counts a member who moves to another unit as a blijver', async () => {
            const rows = await run(cardOf(dashboards, 'nationaal', 'percentage-blijvers-per-eenheid'), { scoutsjaar: secondYear });
            const other = rows.find(row => row['Eenheid'] === '2e Rapporttest');

            // Its one member turns up at the other unit the year after, so none were lost.
            expect(Number(other!['Percentage blijvers'])).toEqual(100);
        });

        /**
         * A period without a single member is not a year the retention can be measured from:
         * reporting against it would read as every member of the year before leaving.
         */
        it('measures against the last year that had members, skipping an empty period', async () => {
            const rows = await run(cardOf(dashboards, 'nationaal', 'percentage-blijvers-per-eenheid'), { scoutsjaar: firstYear });
            const row = rows.find(row => row['Eenheid'] === importedUnit);

            // Neither of the two members of the imported year is back, and the empty period in
            // between is not what firstYear is compared with.
            expect(Number(row!['Percentage blijvers'])).toEqual(0);
        });

        /**
         * The unit's first year has nothing before it to compare against. Reporting 0% there would
         * read as every member leaving.
         */
        it('leaves out a year the unit has no members before', async () => {
            const rows = await run(cardOf(dashboards, 'eenheden', 'eenheid-ledenbehoud'), { eenheid: unit });

            expect(rows.map(row => row['Scoutsjaar'])).toEqual([secondYear]);
        });

        it('splits a unit by geslacht for the varia table', async () => {
            const rows = await run(cardOf(dashboards, 'varia', 'uldk'), { scoutsjaar: firstYear });
            const row = rows.find(row => row['Name'] === unit);

            expect(row!['City']).toEqual('Gent');
            expect(row!['Aantal kinderen/Man']).toEqual(2);
            expect(row!['Aantal kinderen/Vrouw']).toEqual(1);
            expect(row!['Aantal leiding/Vrouw']).toEqual(1);
        });

        it('reports a member without a gender as onbekend rather than dropping them', async () => {
            const rows = await run(cardOf(dashboards, 'eenheden', 'eenheid-leden-per-geslacht'), { scoutsjaar: firstYear, eenheid: unit });

            expect(rows.find(row => row['Geslacht'] === 'Onbekend')?.['Aantal leden']).toEqual(1);
        });

        it('groups the members of a unit by netwerk for the year they were in it', async () => {
            const rows = await run(cardOf(dashboards, 'netwerk', 'leden-per-netwerk'), { scoutsjaar: firstYear });
            const row = rows.find(row => row['Netwerk'] === 'Oost-Vlaanderen');

            expect(row!['Aantal kinderen']).toEqual(3);
            expect(row!['Aantal leiding']).toEqual(1);
            expect(row!['Aantal volwassenen']).toEqual(1);
        });

        /**
         * The import recorded a tak only for leiding and volwassenen, and put every child in a
         * nameless tak with no age range. Counted off the tak alone those members land in no
         * category at all, which showed as "aantal kinderen" being zero for every imported year
         * while the total counted them.
         */
        it('counts a member of the imported tak as a child on their own age', async () => {
            const rows = await run(cardOf(dashboards, 'nationaal', 'leden-per-scoutsjaar'));
            const row = rows.find(row => row['Scoutsjaar'] === importedYear);

            expect(row!['Totaal leden']).toEqual(2);
            expect(row!['Aantal kinderen']).toEqual(1);
            // Nothing distinguishes leiding from volwassenen without a tak, so the adult stays out of both.
            expect(row!['Aantal leiding']).toEqual(0);
            expect(row!['Aantal volwassenen']).toEqual(0);
        });

        it('compares a tak with the same tak the year before', async () => {
            const rows = await run(cardOf(dashboards, 'nationaal', 'leden-per-tak-vergelijking'), { scoutsjaar: secondYear });
            const bevers = rows.find(row => row['Tak'] === 'Bevers');

            // Both unit-A bevers stay, and the unit-B bever joins them.
            expect(bevers!['Aantal leden dit jaar']).toEqual(3);
            // The year before: two at unit A and one at unit B.
            expect(bevers!['Aantal leden vorig jaar']).toEqual(3);
        });
    });
});
