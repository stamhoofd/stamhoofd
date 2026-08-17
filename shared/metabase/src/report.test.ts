import type { ReportCard, ReportTab } from './report.js';
import { loadReport, parseTab, parameterNames, resolveSql } from './report.js';
import { layoutCards } from './sync-report.js';

function cardOf(tabs: ReportTab[], tab: string, card: string): ReportCard {
    const found = tabs.find(entry => entry.key === tab)?.cards.find(entry => entry.key === card);
    if (!found) {
        throw new Error(`No card ${tab}/${card}`);
    }
    return found;
}

/** The cards of a tab as the rows they end up on, in order, with the width they take up together. */
function rowsOf(cards: ReportCard[]): { keys: string[]; width: number }[] {
    const rows = new Map<number, { keys: string[]; width: number }>();

    for (const placed of layoutCards(cards)) {
        const row = rows.get(placed.row) ?? { keys: [], width: 0 };
        rows.set(placed.row, { keys: [...row.keys, placed.card.key], width: row.width + placed.sizeX });
    }

    return [...rows.values()];
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
         * The weights of the index, kept here because nothing else checks them: a wrong weight, or a
         * tak spelled differently from the row in `default_age_groups`, is a plausible number rather
         * than a failure.
         */
        it('weighs each tak of the GTP index as the formula does', () => {
            const sql = cardOf(dashboards, 'eenheden', 'eenheid-gtp').sql.replaceAll(/\s+/g, ' ');

            for (const [tak, term] of [
                ['Bevers, Eekhoorns en Welpen', "( COUNT(DISTINCT CASE WHEN `Tak` = 'Bevers' THEN member_id END) + COUNT(DISTINCT CASE WHEN `Tak` = 'Eekhoorns' THEN member_id END) + COUNT(DISTINCT CASE WHEN `Tak` = 'Welpen' THEN member_id END) ) / 3"],
                ['Wolven', "+ COUNT(DISTINCT CASE WHEN `Tak` = 'Wolven' THEN member_id END)"],
                ['JVG/JG-A', "+ COUNT(DISTINCT CASE WHEN `Tak` = 'Jongverkenners/Jonggidsen - Aspiranten' THEN member_id END)"],
                ['VG/G-J', "+ 2 * COUNT(DISTINCT CASE WHEN `Tak` = 'Verkenners/Gidsen - Juniors' THEN member_id END)"],
                ['Seniors', "+ 3 * COUNT(DISTINCT CASE WHEN `Tak` = 'Seniors' THEN member_id END)"],
                ['Leiding', "+ COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END)"],
                ['omkaderingscijfer', "- 2 * COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END), 0)"],
            ]) {
                expect(`${tak}: ${sql.includes(term)}`).toEqual(`${tak}: true`);
            }
        });

        /**
         * Four cards draw a GTP index, at three different grains. They only agree because they share
         * one fragment, and nothing but this notices when one grows a copy of its own.
         */
        it('computes the GTP index from one expression wherever it is shown', () => {
            const expressions = [['nationaal', 'leden-per-eenheid'], ['eenheden', 'eenheid-gtp'], ['eenheden', 'eenheid-gtp-meter'], ['eenheden', 'eenheid-gtp-per-scoutsjaar']]
                .map(([tab, key]) => cardOf(dashboards, tab, key).sql.replaceAll(/\s+/g, ' ').match(/ROUND\( \( COUNT\(DISTINCT CASE WHEN `Tak` = 'Bevers'.*?, 2\)/)?.[0]);

            expect(expressions.filter(expression => expression !== undefined)).toHaveLength(4);
            expect(new Set(expressions).size).toBe(1);
        });

        it('counts the omkaderingscijfer the same way wherever it is shown', () => {
            const expression = "ROUND( COUNT(DISTINCT CASE WHEN categorie = 'child' THEN member_id END) / NULLIF(COUNT(DISTINCT CASE WHEN categorie = 'leader' THEN member_id END), 0), 2)";

            for (const key of ['eenheid-omkaderingscijfer', 'eenheid-omkaderingscijfer-meter', 'eenheid-omkaderingscijfer-per-scoutsjaar']) {
                const sql = cardOf(dashboards, 'eenheden', key).sql.replaceAll(/\s+/g, ' ');

                expect(`${key}: ${sql.includes(expression)}`).toEqual(`${key}: true`);
            }
        });

        /**
         * Ledenbehoud counts forward: next to scoutsjaar N stands the share of N's own members that
         * was still registered in N+1, the way the client's report reads it. Turned around it is the
         * same figure shifted a year -- a plausible number rather than a failure -- so every card
         * that measures it is checked here. The last year has no year after it and drops out; left
         * in, it would read as 0% ledenbehoud instead of as missing.
         */
        it('measures ledenbehoud from the scoutsjaar it labels into the year after it', () => {
            const cards = dashboards.flatMap(dashboard => dashboard.cards
                .filter(card => card.sql.includes('LEAD(name)'))
                .map(card => [dashboard.key, card] as const));

            expect(cards.map(([dashboard, card]) => `${dashboard}/${card.key}`)).toEqual([
                'nationaal/percentage-blijvers-per-eenheid',
                'eenheden/eenheid-ledenbehoud',
                'eenheden/eenheid-ledenbehoud-per-tak',
                'eenheden/eenheid-evolutie-ledenbehoud',
                'eenheden/eenheid-evolutie-blijvers-per-tak',
            ]);

            for (const [, card] of cards) {
                const sql = card.sql.replaceAll(/\s+/g, ' ');
                const cohort = /JOIN facts huidig ON huidig\.`Scoutsjaar` = \w+\.name/.test(sql);
                const blijvers = /gebleven\.`Scoutsjaar` = \w+\.volgend/.test(sql);

                expect(`${card.key}: cohort ${cohort}, blijvers ${blijvers}, laatste jaar weg ${sql.includes('volgend IS NOT NULL')}`)
                    .toEqual(`${card.key}: cohort true, blijvers true, laatste jaar weg true`);
            }
        });

        /**
         * The page is laid out like the one it mirrors: six figures across the top, each gauge next
         * to the chart of the same figure over the years, and a pie next to each geslacht chart.
         * That pairing only holds while every row is full, since a card that no longer fits pushes
         * the one after it onto a row of its own.
         */
        it('lays the eenheden page out in the rows of the report it mirrors', () => {
            const rows = rowsOf(dashboards.find(dashboard => dashboard.key === 'eenheden')!.cards);
            const rowWith = (key: string) => rows.find(row => row.keys.includes(key))!.keys;

            expect(rows[0].keys).toEqual([
                'eenheid-totaal-leden', 'eenheid-aantal-kinderen', 'eenheid-aantal-leiding',
                'eenheid-aantal-volwassenen', 'eenheid-gtp', 'eenheid-omkaderingscijfer',
            ]);
            expect(rowWith('eenheid-gtp-meter')).toEqual(['eenheid-gtp-meter', 'eenheid-gtp-per-scoutsjaar']);
            expect(rowWith('eenheid-omkaderingscijfer-meter')).toEqual(['eenheid-omkaderingscijfer-meter', 'eenheid-omkaderingscijfer-per-scoutsjaar']);
            expect(rowWith('eenheid-kinderen-per-geslacht')).toEqual(['eenheid-geslacht-kinderen-per-jaar', 'eenheid-kinderen-per-geslacht']);
            expect(rowWith('eenheid-leiding-per-geslacht')).toEqual(['eenheid-geslacht-leiding-per-jaar', 'eenheid-leiding-per-geslacht']);
            expect(rows.filter(row => row.width !== 24)).toEqual([]);
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

        /**
         * The same figure is shown twice on the eenheden page, as a number and as a gauge. Under one
         * title both would be stored as the same question, and the one written last would decide what
         * both of them show.
         */
        it('rejects two cards of a tab under the same title', () => {
            expect(() => parseTab('-- @tab d\n-- title: D\n\n-- @card a\n-- title: C\n-- display: scalar\nSELECT 1\n\n-- @card b\n-- title: C\n-- display: gauge\nSELECT 1', 'x.sql', new Map()))
                .toThrow('two cards are titled "C"');
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
