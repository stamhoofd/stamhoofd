import { getStatisticsConnection } from './connection.js';
import type { ReportCard, ReportDashboard } from './report.js';
import { loadReport, parameterNames, parseDashboard, resolveSql } from './report.js';

/**
 * The years this test works in. Far enough in the past that no other test's periods fall between
 * them: the retention figures read the next scoutsjaar off the periods ordered by date, and this
 * package's suites share one database.
 */
const firstYear = 'Testjaar 1990 - 1991';
const secondYear = 'Testjaar 1991 - 1992';
const unit = '1e Rapporttest';

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

function cardOf(dashboards: ReportDashboard[], dashboard: string, card: string): ReportCard {
    const found = dashboards.find(entry => entry.key === dashboard)?.cards.find(entry => entry.key === card);
    if (!found) {
        throw new Error(`No card ${dashboard}/${card}`);
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
        { id: 'rt-p1', startDate: new Date(Date.UTC(1990, 8, 1)), endDate: new Date(Date.UTC(1991, 7, 31)), name: firstYear, customName: firstYear, createdAt: now, updatedAt: now },
        { id: 'rt-p2', startDate: new Date(Date.UTC(1991, 8, 1)), endDate: new Date(Date.UTC(1992, 7, 31)), name: secondYear, customName: secondYear, createdAt: now, updatedAt: now },
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

    const members = [
        { id: 'rt-m1', birthDate: '1984-06-01', gender: 'Male', postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m2', birthDate: '1984-07-01', gender: 'Female', postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m3', birthDate: '1975-01-01', gender: 'Male', postalCode: '9030', organizationId: 'rt-org-a' },
        { id: 'rt-m4', birthDate: '1968-01-01', gender: 'Female', postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m5', birthDate: '1950-01-01', gender: null, postalCode: '9000', organizationId: 'rt-org-a' },
        { id: 'rt-m6', birthDate: '1984-02-01', gender: 'Male', postalCode: '8000', organizationId: 'rt-org-b' },
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
    ];
    await insert('registrations', registrations.map(registration => ({
        ...registration, registeredAt: new Date(Date.UTC(1990, 8, 15)), startDate: null, endDate: null,
        trialUntil: null, deactivatedAt: null, waitingList: 0, cycle: 0, createdAt: now, updatedAt: now,
    })));

    await insert('platform_membership_types', [{ id: 'rt-mt-normal', name: 'Normal' }]);
    await insert('member_platform_memberships', members.slice(0, 5).map((member, index) => ({
        id: `rt-mpm-${index}`, memberId: member.id, membershipTypeId: 'rt-mt-normal', organizationId: 'rt-org-a',
        periodId: 'rt-p1', startDate: new Date(Date.UTC(1990, 8, 1)), endDate: new Date(Date.UTC(1991, 7, 31)),
        expireDate: null, trialUntil: null, deletedAt: null, createdAt: now, updatedAt: now,
    })));
}

describe('report', () => {
    let dashboards: ReportDashboard[];

    beforeAll(async () => {
        dashboards = await loadReport();
        await clean();
        await seed();
    });

    describe('definition', () => {
        it('has the four dashboards of the report plus the filter values', () => {
            expect(dashboards.map(dashboard => dashboard.key)).toEqual(['nationaal', 'eenheden', 'netwerk', 'varia', 'filters']);
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
                for (const card of dashboard.cards.filter(card => ['bar', 'line', 'combo', 'pie'].includes(card.display))) {
                    expect(`${card.key}: ${card.dimensions.length}`).not.toEqual(`${card.key}: 0`);
                    expect(`${card.key}: ${card.metrics.length}`).not.toEqual(`${card.key}: 0`);

                    for (const column of [...card.dimensions, ...card.metrics]) {
                        expect(`${card.key} selects ${column}`).toEqual(card.sql.includes(`\`${column}\``) ? `${card.key} selects ${column}` : `${card.key} does not select ${column}`);
                    }
                }
            }
        });

        it('gives the unit filter to the eenheden dashboard only, as the report does', () => {
            expect(dashboards.find(dashboard => dashboard.key === 'eenheden')!.filters).toEqual(['scoutsjaar', 'eenheid']);

            for (const key of ['nationaal', 'netwerk', 'varia']) {
                expect(`${key}: ${dashboards.find(dashboard => dashboard.key === key)!.filters.join(',')}`).toEqual(`${key}: scoutsjaar`);
            }
        });

        it('rejects a filter no card can be driven by', () => {
            expect(() => parseDashboard('-- @dashboard d\n-- title: D\n-- filters: eenheid\n\n-- @card c\n-- title: C\n-- display: table\nSELECT 1', 'x.sql', new Map()))
                .toThrow('no card uses {{eenheid}}');
        });

        it('rejects a card without a title', () => {
            expect(() => parseDashboard('-- @dashboard d\n-- title: D\n\n-- @card c\n-- display: table\nSELECT 1', 'x.sql', new Map()))
                .toThrow('"c" has no title');
        });

        it('rejects an include that does not exist', () => {
            expect(() => parseDashboard('-- @dashboard d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: table\n-- @include nope\nSELECT 1', 'x.sql', new Map()))
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

        it('counts a member who comes back the year after as a blijver', async () => {
            const rows = await run(cardOf(dashboards, 'nationaal', 'percentage-blijvers-per-eenheid'), { scoutsjaar: firstYear });
            const row = rows.find(row => row['Eenheid'] === unit);

            // Three of the five members return.
            expect(Number(row!['Percentage blijvers'])).toEqual(60);
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

        it('compares a tak with the same tak the year before', async () => {
            const rows = await run(cardOf(dashboards, 'nationaal', 'leden-per-tak-vergelijking'), { scoutsjaar: secondYear });
            const bevers = rows.find(row => row['Tak'] === 'Bevers');

            expect(bevers!['Aantal leden dit jaar']).toEqual(2);
            // The third unit-A bever of the first year was a verkenner, and unit B had one bever.
            expect(bevers!['Aantal leden vorig jaar']).toEqual(3);
        });
    });
});
