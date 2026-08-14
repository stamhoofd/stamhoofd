import type { ReportCard, ReportTab } from './report.js';
import { loadReport, parseTab, parameterNames, resolveSql } from './report.js';

function cardOf(tabs: ReportTab[], tab: string, card: string): ReportCard {
    const found = tabs.find(entry => entry.key === tab)?.cards.find(entry => entry.key === card);
    if (!found) {
        throw new Error(`No card ${tab}/${card}`);
    }
    return found;
}

describe('report', () => {
    let dashboards: ReportTab[];

    beforeAll(async () => {
        dashboards = await loadReport();
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

        /**
         * The index is one expression over a `gtp_basis` that every card writes for its own grain,
         * so a card can hand it columns that are not there. Nothing says so until someone opens the
         * dashboard and Metabase reports an unknown column.
         */
        it('gives every card showing a GTP index the columns the formula divides', () => {
            for (const [tab, key] of [['nationaal', 'leden-per-eenheid'], ['eenheden', 'eenheid-gtp'], ['eenheden', 'eenheid-gtp-per-scoutsjaar']]) {
                const sql = cardOf(dashboards, tab, key).sql;

                expect(`${key}: ${sql.includes('gb.gtp_waarden /')}`).toEqual(`${key}: true`);

                for (const column of ['gtp_waarden', 'kinderen', 'leiding']) {
                    expect(`${key} supplies ${column}`).toEqual(sql.includes(`AS ${column}`) ? `${key} supplies ${column}` : `${key} misses ${column}`);
                }
            }
        });

        /**
         * The weights of the GTP waarden, kept here because nothing else checks them: the takken are
         * recognised by their age range, so a wrong weight is a plausible number rather than a
         * failure.
         */
        it('weighs each tak of the GTP waarden as the formula does', () => {
            const sql = cardOf(dashboards, 'eenheden', 'eenheid-gtp').sql;

            for (const [tak, term] of [
                ['Bevers en Welpen', "3 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) <= 10"],
                ['JVG/JG-A', "1 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) BETWEEN 11 AND 13"],
                ['VG/G-J', "2 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) BETWEEN 14 AND 16"],
                ['Seniors', "3 * COUNT(DISTINCT CASE WHEN categorie = 'child' AND COALESCE(tak_min_age, leeftijd) >= 17"],
                ['Leiding', "+ COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END)"],
            ]) {
                expect(`${tak}: ${sql.includes(term)}`).toEqual(`${tak}: true`);
            }
        });

        it('counts the omkaderingscijfer the same way wherever it is shown', () => {
            const expression = "ROUND( COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END), 0), 2)";

            for (const key of ['eenheid-omkaderingscijfer', 'eenheid-omkaderingscijfer-per-scoutsjaar']) {
                const sql = cardOf(dashboards, 'eenheden', key).sql.replaceAll(/\s+/g, ' ');

                expect(`${key}: ${sql.includes(expression)}`).toEqual(`${key}: true`);
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
            // A bar per eenheid leaves too little room to read a label at an angle: Metabase drops
            // the ones that touch, so those two stand upright.
            expect(cardOf(dashboards, 'nationaal', 'leden-per-eenheid').xLabels).toEqual('rotate-90');
            expect(cardOf(dashboards, 'nationaal', 'percentage-blijvers-per-eenheid').xLabels).toEqual('rotate-90');
            expect(cardOf(dashboards, 'nationaal', 'leden-per-tak-vergelijking').xLabels).toEqual('rotate-45');
            expect(cardOf(dashboards, 'nationaal', 'leden-per-geboortejaar').xLabels).toBeUndefined();
        });

        /**
         * A setting only counts above the query. One comment written above it pushes the whole
         * block below the line, and every setting under it would be dropped without a word.
         */
        it('rejects a setting that slipped below the query', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- A note.\n-- display: bar\nSELECT 1', 'x.sql', new Map()))
                .toThrow('has "display:" below the query');
        });

        it('leaves a comment that merely looks like a setting alone', () => {
            const tab = parseTab('-- @tab d\n-- title: D\n\n-- @card c\n-- title: C\n-- display: table\n-- A note.\n-- see: the note above\nSELECT 1', 'x.sql', new Map());

            expect(tab.cards[0].sql).toContain('-- see: the note above');
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
});
