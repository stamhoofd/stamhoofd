import { describe, expect, it } from 'vitest';
import type { ReportCard, ReportTab } from './metabase-report.js';
import { buildDashcards, buildParameters, buildTabs, buildTemplateTags, buildVisualizationSettings, layoutCards, templateTagId } from './metabase-report.js';

function card(overrides: Partial<ReportCard> = {}): ReportCard {
    return {
        key: 'totaal-leden',
        title: 'Totaal leden',
        display: 'scalar',
        size: 'half',
        dimensions: [],
        metrics: [],
        parameters: [],
        sql: 'SELECT 1',
        ...overrides,
    };
}

function tab(overrides: Partial<ReportTab> = {}): ReportTab {
    return { key: 'nationaal', title: 'Nationaal', filters: [], hidden: false, cards: [], ...overrides };
}

describe('layoutCards', () => {
    it('puts the five figures the report leads with on one row', () => {
        const placed = layoutCards(Array.from({ length: 5 }, (_, index) => card({ key: `k${index}`, size: 'fifth' })));

        expect(placed.map(entry => entry.col)).toEqual([0, 4, 8, 12, 16]);
        expect(placed.every(entry => entry.row === 0)).toBe(true);
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

    it('draws a combo chart as bars with a line over them, for the GTP index', () => {
        const settings = buildVisualizationSettings(card({ display: 'combo', dimensions: ['Eenheid'], metrics: ['Aantal leden', 'GTP index'] }));

        expect(settings['graph.series_settings']).toEqual({ 'Aantal leden': { display: 'bar' }, 'GTP index': { display: 'line' } });
    });

    it('stacks a ratio chart to full width', () => {
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Scoutsjaar'], metrics: ['Jong', 'Oud'], stacked: 'normalized' }))['stackable.stack_type']).toEqual('normalized');
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
