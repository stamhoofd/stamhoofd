import { describe, expect, it } from 'vitest';
import type { ReportCard, ReportTab } from './report.js';
import { buildDashcards, buildParameters, buildTabs, buildTemplateTags, buildVisualizationSettings, collectionToRename, dashcardKey, groupByDashboard, layoutCards, templateTagId } from './sync-report.js';

function card(overrides: Partial<ReportCard> = {}): ReportCard {
    return {
        key: 'totaal-leden',
        title: 'Totaal leden',
        display: 'scalar',
        size: 'half',
        dimensions: [],
        metrics: [],
        columns: [],
        parameters: [],
        sql: 'SELECT 1',
        ...overrides,
    };
}

function tab(overrides: Partial<ReportTab> = {}): ReportTab {
    return { key: 'nationaal', title: 'Nationaal', filters: [], hidden: false, cards: [], ...overrides };
}

describe('layoutCards', () => {
    it('puts the six figures the report leads with on one row', () => {
        const placed = layoutCards(Array.from({ length: 6 }, (_, index) => card({ key: `k${index}`, size: 'sixth' })));

        expect(placed.map(entry => entry.col)).toEqual([0, 4, 8, 12, 16, 20]);
        expect(placed.every(entry => entry.row === 0)).toBe(true);
    });

    /**
     * Each gauge of the eenheden page stands beside the chart of the same figure over the years. At
     * the height of a scalar it would hang above the chart with a band of empty grid under it.
     */
    it('makes a gauge as tall as the chart beside it', () => {
        const [gauge, chart] = layoutCards([
            card({ key: 'a', size: 'third', display: 'gauge' }),
            card({ key: 'b', size: 'two-thirds', display: 'line' }),
        ]);

        expect(gauge).toMatchObject({ row: 0, col: 0, sizeX: 8 });
        expect(chart).toMatchObject({ row: 0, col: 8, sizeX: 16 });
        expect(gauge.sizeY).toEqual(chart.sizeY);
    });

    it('wraps to a new row below the tallest card of the previous one', () => {
        const placed = layoutCards([
            card({ key: 'a', size: 'half', display: 'table' }),
            card({ key: 'b', size: 'half', display: 'bar' }),
            card({ key: 'c', size: 'full', display: 'bar' }),
        ]);

        // The table is 8 high and the chart next to it 6, so the next row starts at 8.
        expect(placed[2]).toMatchObject({ row: 8, col: 0, sizeX: 24 });
    });

    /**
     * Rotated labels are drawn below the plot rather than beside it, so a card at the normal height
     * is left with bars too short to compare. The room they take is paid for on top.
     */
    it('makes a chart with rotated labels taller, so the plot keeps its room', () => {
        const [plain] = layoutCards([card({ key: 'a', size: 'full', display: 'bar' })]);
        const [rotated] = layoutCards([card({ key: 'a', size: 'full', display: 'bar', xLabels: 'rotate-45' })]);
        const [upright] = layoutCards([card({ key: 'a', size: 'full', display: 'bar', xLabels: 'rotate-90' })]);

        expect(rotated.sizeY).toBeGreaterThan(plain.sizeY);
        // Reading the label sideways takes more room than reading it at an angle.
        expect(upright.sizeY).toBeGreaterThan(rotated.sizeY);
    });

    /**
     * The band is as tall as the longest label, which does not change with the width of the card.
     */
    it('adds the same room to a half card as to a full one', () => {
        const grew = (size: 'full' | 'half') =>
            layoutCards([card({ key: 'a', size, display: 'bar', xLabels: 'rotate-45' })])[0].sizeY
            - layoutCards([card({ key: 'a', size, display: 'bar' })])[0].sizeY;

        expect(grew('half')).toEqual(grew('full'));
    });

    it('leaves a card that never rotates at its normal height', () => {
        const [plain] = layoutCards([card({ key: 'a', size: 'full', display: 'bar' })]);
        const [compact] = layoutCards([card({ key: 'a', size: 'full', display: 'bar', xLabels: 'compact' })]);

        expect(compact.sizeY).toEqual(plain.sizeY);
    });

    it('never lets a card hang over the edge of the grid', () => {
        const placed = layoutCards([card({ key: 'a', size: 'third' }), card({ key: 'b', size: 'full' })]);

        for (const entry of placed) {
            expect(entry.col + entry.sizeX).toBeLessThanOrEqual(24);
        }
    });
});

describe('buildVisualizationSettings', () => {
    it('names the columns a chart puts on each axis', () => {
        const settings = buildVisualizationSettings(card({ display: 'bar', dimensions: ['Tak'], metrics: ['Aantal leden dit jaar', 'Aantal leden vorig jaar'] }));

        expect(settings['graph.dimensions']).toEqual(['Tak']);
        expect(settings['graph.metrics']).toEqual(['Aantal leden dit jaar', 'Aantal leden vorig jaar']);
    });

    /**
     * Under `series_settings`, not `graph.series_settings`: Metabase drops a setting it does not
     * know without a word, which leaves the combo chart on its default of a line for the first
     * series and bars for the rest -- exactly the wrong way round for this chart.
     */
    it('draws a combo chart as bars with a line over them, for the GTP index', () => {
        const settings = buildVisualizationSettings(card({ display: 'combo', dimensions: ['Eenheid'], metrics: ['Aantal leden', 'GTP index'] }));

        expect(settings['series_settings']).toEqual({ 'Aantal leden': { display: 'bar' }, 'GTP index': { display: 'line' } });
        expect(settings).not.toHaveProperty('graph.series_settings');
    });

    /**
     * Metabase writes the header of an export from the column's title and makes one up out of the
     * alias when the column has none. A sheet delivered to a government department is read by those
     * headers, so every column of one carries the title the template gives it.
     */
    it('titles the columns of a sheet exactly as it is delivered', () => {
        const settings = buildVisualizationSettings(card({ display: 'table', columns: ['ID_Organisatie', 'Naam_Organisatie'] }));

        expect(settings['column_settings']).toEqual({
            '["name","ID_Organisatie"]': { column_title: 'ID_Organisatie' },
            '["name","Naam_Organisatie"]': { column_title: 'Naam_Organisatie' },
        });
    });

    it('leaves the columns of a card that names none to Metabase', () => {
        expect(buildVisualizationSettings(card({ display: 'table' }))).not.toHaveProperty('column_settings');
    });

    it('stacks a ratio chart to full width', () => {
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Scoutsjaar'], metrics: ['Jong', 'Oud'], stacked: 'normalized' }))['stackable.stack_type']).toEqual('normalized');
    });

    /**
     * Left to itself Metabase hides the labels along the x-axis as soon as too many of them do not
     * fit, which is every chart with a bar per eenheid. It only makes that decision when the
     * setting is absent, so naming a rotation is what keeps the names under the bars.
     */
    it('rotates the x-axis labels when the card asks for it', () => {
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Eenheid'], metrics: ['Percentage blijvers'], xLabels: 'rotate-45' }))['graph.x_axis.axis_enabled']).toEqual('rotate-45');
        expect(buildVisualizationSettings(card({ display: 'combo', dimensions: ['Eenheid'], metrics: ['Aantal leden'], xLabels: 'rotate-90' }))['graph.x_axis.axis_enabled']).toEqual('rotate-90');
    });

    it('says nothing about the x-axis for a card that does not ask, so Metabase keeps deciding', () => {
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Scoutsjaar'], metrics: ['Jong'] }))).not.toHaveProperty('graph.x_axis.axis_enabled');
    });

    it('turns the report\'s own words for the x-axis into the ones Metabase uses', () => {
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Tak'], metrics: ['A'], xLabels: 'hide' }))['graph.x_axis.axis_enabled']).toEqual(false);
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Tak'], metrics: ['A'], xLabels: 'show' }))['graph.x_axis.axis_enabled']).toEqual(true);
    });

    it('uses the pie settings for a pie, which ignores the graph ones', () => {
        const settings = buildVisualizationSettings(card({ display: 'pie', dimensions: ['Geslacht'], metrics: ['Aantal leden'] }));

        expect(settings['pie.dimension']).toEqual('Geslacht');
        expect(settings['graph.dimensions']).toBeUndefined();
    });
});

describe('buildTemplateTags', () => {
    it('declares a tag for every parameter the query uses', () => {
        const tags = buildTemplateTags(card({ parameters: ['scoutsjaar'] })) as Record<string, { name: string; type: string; 'display-name': string }>;

        expect(tags.scoutsjaar).toMatchObject({ name: 'scoutsjaar', type: 'text', 'display-name': 'Scoutsjaar' });
    });

    /**
     * Metabase rebuilds every filter connection when a tag id changes, so pushing the report twice
     * has to produce the same ids.
     */
    it('gives a tag the same id on every run', () => {
        expect(templateTagId('totaal-leden', 'scoutsjaar')).toEqual(templateTagId('totaal-leden', 'scoutsjaar'));
        expect(templateTagId('totaal-leden', 'scoutsjaar')).not.toEqual(templateTagId('aantal-leiding', 'scoutsjaar'));
    });
});

describe('buildParameters', () => {
    it('shows only the filters the dashboard declares, not every one its cards accept', () => {
        const parameters = buildParameters([tab({ filters: ['scoutsjaar'], cards: [card({ parameters: ['scoutsjaar', 'eenheid'] })] })], new Map());

        expect(parameters.map(parameter => parameter.slug)).toEqual(['scoutsjaar']);
    });

    it('fills a dropdown from the card that lists the values', () => {
        const parameters = buildParameters([tab({ filters: ['scoutsjaar'], cards: [card({ parameters: ['scoutsjaar'] })] })], new Map([['scoutsjaar', 42]]));

        expect(parameters[0].values_source_type).toEqual('card');
        expect(parameters[0].values_source_config).toEqual({ card_id: 42, value_field: ['field', 'Scoutsjaar', { 'base-type': 'type/Text' }] });
    });

    /**
     * The values source alone still leaves a text box; this is the setting that makes the widget a
     * dropdown, so nobody has to type a scoutsjaar by hand.
     */
    it('asks for a dropdown rather than an input box', () => {
        const parameters = buildParameters([tab({ filters: ['scoutsjaar', 'eenheid'], cards: [card({ parameters: ['scoutsjaar', 'eenheid'] })] })], new Map([['scoutsjaar', 42], ['eenheid', 43]]));

        expect(parameters.map(parameter => parameter.values_query_type)).toEqual(['list', 'list']);
    });

    /**
     * Metabase sorts a dropdown fed by a question alphabetically, which would put the oldest
     * scoutsjaar first. A fixed list is the only source it leaves in the given order.
     */
    it('writes the scoutsjaren out as a list, newest first', () => {
        const years = ['2024 - 2025', '2023 - 2024', '2013 - 2014'];
        const entry = [tab({ filters: ['scoutsjaar', 'eenheid'], cards: [card({ parameters: ['scoutsjaar', 'eenheid'] })] })];

        const parameters = buildParameters(entry, new Map([['scoutsjaar', 42], ['eenheid', 43]]), new Map([['scoutsjaar', years]]));

        expect(parameters[0].values_source_type).toEqual('static-list');
        expect(parameters[0].values_source_config).toEqual({ values: years });
        // Unit names read fine alphabetically, so they stay on the question and keep updating.
        expect(parameters[1].values_source_type).toEqual('card');
    });

    it('falls back to the question when the values could not be read', () => {
        const entry = [tab({ filters: ['scoutsjaar'], cards: [card({ parameters: ['scoutsjaar'] })] })];

        for (const values of [new Map(), new Map([['scoutsjaar', []]])]) {
            expect(buildParameters(entry, new Map([['scoutsjaar', 42]]), values as Map<string, string[]>)[0].values_source_type).toEqual('card');
        }
    });
});

describe('buildTabs', () => {
    it('keeps the id of a tab that is already there, so links into it survive', () => {
        const tabs = buildTabs([tab({ title: 'Nationaal' }), tab({ key: 'varia', title: 'Varia' })], new Map([['Nationaal', 7]]));

        expect(tabs).toEqual([
            { id: 7, name: 'Nationaal', position: 0 },
            // Negative is how Metabase is told to create one.
            { id: -2, name: 'Varia', position: 1 },
        ]);
    });
});

describe('buildDashcards', () => {
    it('connects a filter only to the cards whose query takes it', () => {
        const filtered = card({ key: 'a', parameters: ['scoutsjaar'] });
        const unfiltered = card({ key: 'b', parameters: [] });
        const entry = [tab({ filters: ['scoutsjaar'], cards: [filtered, unfiltered] })];
        const parameters = buildParameters(entry, new Map());

        const dashcards = buildDashcards(entry, new Map([['a', 1], ['b', 2]]), parameters, new Map([['Nationaal', 1]]));

        expect((dashcards[0].parameter_mappings as unknown[]).length).toEqual(1);
        expect(dashcards[0].parameter_mappings).toMatchObject([{ card_id: 1, target: ['variable', ['template-tag', 'scoutsjaar']] }]);
        expect(dashcards[1].parameter_mappings).toEqual([]);
    });

    it('puts each card on its own tab', () => {
        const tabs = [
            tab({ key: 'nationaal', title: 'Nationaal', cards: [card({ key: 'a' })] }),
            tab({ key: 'varia', title: 'Varia', cards: [card({ key: 'b' })] }),
        ];

        const dashcards = buildDashcards(tabs, new Map([['a', 1], ['b', 2]]), [], new Map([['Nationaal', 10], ['Varia', 11]]));

        expect(dashcards.map(entry => [entry.card_id, entry.dashboard_tab_id])).toEqual([[1, 10], [2, 11]]);
        // Each tab is laid out on a grid of its own.
        expect(dashcards.map(entry => entry.row)).toEqual([0, 0]);
    });

    /**
     * Metabase addresses a card on a dashboard by the id of its placement, which the browser keeps
     * asking for while the page stays open. Handing out new ones on every run answers each of those
     * with a 404, so a dashboard someone had open shows an error on every card until it is loaded
     * again -- and the report is written again on every change to it.
     */
    it('leaves a card that is still on the same tab under the id it was placed with', () => {
        const tabs = [tab({ key: 'eenheden', title: 'Eenheden', cards: [card({ key: 'a' }), card({ key: 'b', title: 'Aantal leiding' })] })];
        const existing = new Map([[dashcardKey(11, 1), 500]]);

        const dashcards = buildDashcards(tabs, new Map([['a', 1], ['b', 2]]), [], new Map([['Eenheden', 11]]), existing);

        expect(dashcards[0].id).toEqual(500);
        // The one that was not there yet is new, which Metabase reads from a negative id.
        expect(dashcards[1].id as number).toBeLessThan(0);
    });

    it('places a card that moved to another tab anew, since its old placement belongs to the old tab', () => {
        const tabs = [tab({ key: 'varia', title: 'Varia', cards: [card({ key: 'a' })] })];
        const existing = new Map([[dashcardKey(11, 1), 500]]);

        const dashcards = buildDashcards(tabs, new Map([['a', 1]]), [], new Map([['Varia', 12]]), existing);

        expect(dashcards[0].id as number).toBeLessThan(0);
    });

    /**
     * Metabase shows every filter above the whole dashboard. A card on the Nationaal tab must not be
     * driven by the unit filter, or picking a unit would quietly turn the national figures into one
     * unit's.
     */
    it('leaves a card alone when its own tab does not use the filter', () => {
        const tabs = [
            tab({ key: 'nationaal', title: 'Nationaal', filters: ['scoutsjaar'], cards: [card({ key: 'a', parameters: ['scoutsjaar', 'eenheid'] })] }),
            tab({ key: 'eenheden', title: 'Eenheden', filters: ['scoutsjaar', 'eenheid'], cards: [card({ key: 'b', parameters: ['scoutsjaar', 'eenheid'] })] }),
        ];
        const parameters = buildParameters(tabs, new Map());

        const dashcards = buildDashcards(tabs, new Map([['a', 1], ['b', 2]]), parameters, new Map([['Nationaal', 10], ['Eenheden', 11]]));

        expect((dashcards[0].parameter_mappings as { parameter_id: string }[]).length).toEqual(1);
        expect((dashcards[1].parameter_mappings as { parameter_id: string }[]).length).toEqual(2);
    });
});

describe('groupByDashboard', () => {
    /**
     * The pages of the client's own report belong together on one dashboard, and a tab that mirrors
     * none of them -- the aanlevering to the department -- is opened on its own terms.
     */
    it('puts the pages of the report on one dashboard and gives a tab that asks for its own another', () => {
        const grouped = groupByDashboard([
            tab({ key: 'nationaal', title: 'Nationaal' }),
            tab({ key: 'eenheden', title: 'Eenheden' }),
            tab({ key: 'jeugdbewegingen', title: 'Jeugdbewegingen', dashboard: 'Aanlevering' }),
        ], 'Ledenstatistieken');

        expect(grouped.map(dashboard => [dashboard.name, dashboard.tabs.map(entry => entry.title)]))
            .toEqual([['Ledenstatistieken', ['Nationaal', 'Eenheden']], ['Aanlevering', ['Jeugdbewegingen']]]);
    });

    it('keeps the tabs of one dashboard together in the order the report lists them', () => {
        const grouped = groupByDashboard([
            tab({ key: 'a', title: 'A', dashboard: 'Andere' }),
            tab({ key: 'b', title: 'B' }),
            tab({ key: 'c', title: 'C', dashboard: 'Andere' }),
        ], 'Ledenstatistieken');

        expect(grouped.map(dashboard => dashboard.name)).toEqual(['Andere', 'Ledenstatistieken']);
        expect(grouped[0].tabs.map(entry => entry.title)).toEqual(['A', 'C']);
    });
});

describe('collectionToRename', () => {
    /**
     * An instance that served one platform keeps the collection it has: renaming it holds on to every
     * question, dashboard, link and bookmark in it, where writing a new one would leave all of that
     * behind under a name nothing writes any more.
     */
    it('renames the collection left from when there was one per environment', () => {
        const collections = [{ id: 3, name: 'Ledenstatistieken (keeo)' }, { id: 4, name: 'Iets van de klant' }];

        expect(collectionToRename(collections, 'Ledenstatistieken')?.id).toBe(3);
    });

    it('leaves the collection alone once it carries the name written now', () => {
        const collections = [{ id: 3, name: 'Ledenstatistieken (keeo)' }, { id: 9, name: 'Ledenstatistieken' }];

        expect(collectionToRename(collections, 'Ledenstatistieken')).toBeUndefined();
    });

    /** A development machine that served several platforms has no single right answer. */
    it('renames nothing when several are left', () => {
        const collections = [{ id: 3, name: 'Ledenstatistieken (keeo)' }, { id: 5, name: 'Ledenstatistieken (ravot)' }];

        expect(collectionToRename(collections, 'Ledenstatistieken')).toBeUndefined();
    });
});
