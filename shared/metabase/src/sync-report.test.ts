import { describe, expect, it } from 'vitest';
import type { MetabaseApi } from './api.js';
import type { ReportCard, ReportTab } from './report.js';
import { buildDashcards, buildParameters, buildTabs, buildTemplateTags, buildVisualizationSettings, chartColors, collectionToRename, columnPalettes, dashcardKey, environmentColors, groupByDashboard, layoutCards, segmentColors, snippetTagName, syncSnippets, templateTagId } from './sync-report.js';

function card(overrides: Partial<ReportCard> = {}): ReportCard {
    return {
        key: 'totaal-leden',
        title: 'Totaal leden',
        display: 'scalar',
        size: 'half',
        dimensions: [],
        metrics: [],
        columns: [],
        segments: [],
        best: 'high',
        span: 1,
        parameters: [],
        snippets: [],
        sql: 'SELECT 1',
        snippetSql: 'SELECT 1',
        ...overrides,
    };
}

function tab(overrides: Partial<ReportTab> = {}): ReportTab {
    return { key: 'nationaal', title: 'Nationaal', filters: [], required: [], hidden: false, cards: [], ...overrides };
}

describe('layoutCards', () => {
    it('puts the six figures the report leads with on one row', () => {
        const placed = layoutCards(Array.from({ length: 6 }, (_, index) => card({ key: `k${index}`, size: 'sixth' })));

        expect(placed.map(entry => entry.col)).toEqual([0, 4, 8, 12, 16, 20]);
        expect(placed.every(entry => entry.row === 0)).toBe(true);
    });

    /**
     * A card spanning two rows keeps its columns in the second one, so the card after it wraps under
     * the first rather than beside it, and ends up as tall as both rows together. It does not decide
     * how tall they are: the cards stacked beside it do, which is what makes the two columns end on
     * the same line.
     */
    it('stands a spanning card beside the cards stacked next to it', () => {
        const [chart, map, pie] = layoutCards([
            card({ key: 'chart', size: 'half', display: 'bar', height: 10 }),
            card({ key: 'map', size: 'half', display: 'map', span: 2 }),
            card({ key: 'pie', size: 'half', display: 'pie' }),
        ]);

        expect(chart).toMatchObject({ row: 0, col: 0, sizeX: 12, sizeY: 10 });
        expect(map).toMatchObject({ row: 0, col: 12, sizeX: 12, sizeY: 16 });
        expect(pie).toMatchObject({ row: 10, col: 0, sizeX: 12, sizeY: 6 });
    });

    it('draws a card at the height it asks for instead of the one its display takes', () => {
        const [placed] = layoutCards([card({ size: 'full', display: 'bar', height: 12 })]);

        expect(placed.sizeY).toEqual(12);
    });

    /**
     * The pie of the geslachten stands beside the chart of the same geslachten over the years, and a
     * pie that stops at the height of a normal chart leaves a hole under it: the row below starts
     * where the taller card ends either way.
     */
    it('draws every card of a row down to the same line', () => {
        const [chart, pie] = layoutCards([
            card({ key: 'a', size: 'two-thirds', display: 'row' }),
            card({ key: 'b', size: 'third', display: 'pie' }),
        ]);

        expect(pie.row).toEqual(chart.row);
        expect(pie.sizeY).toEqual(chart.sizeY);
        expect(pie.sizeX).toEqual(8);
    });

    /**
     * A row chart holds a bar per scoutsjaar, and Metabase gives each of them 24 pixels: the ones
     * that no longer fit in the card are dropped rather than squeezed, so a row chart the height of
     * a normal chart would quietly lose the oldest years as they pile up.
     */
    it('makes a row chart tall enough for the years it holds', () => {
        const [rows, bars] = layoutCards([
            card({ key: 'a', size: 'two-thirds', display: 'row' }),
            card({ key: 'b', size: 'two-thirds', display: 'bar' }),
        ]);

        expect(rows.sizeY).toBeGreaterThan(bars.sizeY);
        expect(rows.sizeY).toEqual(10);
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

    /**
     * A gauge without ranges of its own is three equal ones between zero and whatever it first drew,
     * which says nothing about whether the figure is a good one. The boundaries come from the card;
     * what a color says is decided here, so the ranges of one figure are read against each other.
     */
    it('colors a gauge from red at its worst to green at its best', () => {
        const settings = buildVisualizationSettings(card({ display: 'gauge', segments: [0, 35, 55, 75, 95, 115, 135] }));

        expect(settings['gauge.segments']).toEqual([
            { min: 0, max: 35, color: '#ed6e6e', label: '< 35' },
            { min: 35, max: 55, color: '#f2955f', label: '35-55' },
            { min: 55, max: 75, color: '#f7bc50', label: '55-75' },
            { min: 75, max: 95, color: '#e2cb49', label: '75-95' },
            { min: 95, max: 115, color: '#b3c34a', label: '95-115' },
            { min: 115, max: 135, color: '#84bb4c', label: '> 115' },
        ]);
    });

    /**
     * The other meter of the page: an omkaderingscijfer is better the lower it is, so the same scale
     * is read from the other end. Its first range is twice as long as the others -- a leider looking
     * after two leden and one looking after four are the same eenheid in practice -- which the arc
     * shows as a wider band rather than as a jump in the colors.
     */
    it('colors a gauge whose low end is the good one from green to red', () => {
        const settings = buildVisualizationSettings(card({ display: 'gauge', segments: [0, 4, 6, 8, 10, 12], best: 'low' }));

        expect(settings['gauge.segments']).toEqual([
            { min: 0, max: 4, color: '#84bb4c', label: '< 4' },
            { min: 4, max: 6, color: '#bfc54a', label: '4-6' },
            { min: 6, max: 8, color: '#f9cf48', label: '6-8' },
            { min: 8, max: 10, color: '#f39f5b', label: '8-10' },
            { min: 10, max: 12, color: '#ed6e6e', label: '> 10' },
        ]);
    });

    it('leaves the ranges of a gauge that names none to Metabase', () => {
        expect(buildVisualizationSettings(card({ display: 'gauge' }))).not.toHaveProperty('gauge.segments');
        expect(buildVisualizationSettings(card({ display: 'scalar' }))).not.toHaveProperty('scalar.segments');
    });

    /**
     * The number at the top of the page in the colors of the meter below it. Its outer ranges are
     * left open where the arc has to stop: an eenheid at 200 falls outside every range of the gauge,
     * and a number that matches none is drawn in the plain text color -- the one reading where the
     * color says the most.
     */
    it('colors a number in the ranges of the meter of the same figure', () => {
        const segments = [0, 35, 55, 75, 95, 115, 135];
        const number = buildVisualizationSettings(card({ display: 'scalar', segments }))['scalar.segments'];

        expect(number).toEqual([
            { max: 35, color: '#ed6e6e' },
            { min: 35, max: 55, color: '#f2955f' },
            { min: 55, max: 75, color: '#f7bc50' },
            { min: 75, max: 95, color: '#e2cb49' },
            { min: 95, max: 115, color: '#b3c34a' },
            { min: 115, color: '#84bb4c' },
        ]);

        const meter = buildVisualizationSettings(card({ display: 'gauge', segments }))['gauge.segments'] as { color: string }[];
        expect((number as { color: string }[]).map(segment => segment.color)).toEqual(meter.map(segment => segment.color));
    });

    it('reads a number from the end its ranges are good at, as its meter does', () => {
        const segments = [0, 4, 6, 8, 10, 12];
        const number = buildVisualizationSettings(card({ display: 'scalar', segments, best: 'low' }))['scalar.segments'];

        expect(number).toEqual([
            { max: 4, color: '#84bb4c' },
            { min: 4, max: 6, color: '#bfc54a' },
            { min: 6, max: 8, color: '#f9cf48' },
            { min: 8, max: 10, color: '#f39f5b' },
            { min: 10, color: '#ed6e6e' },
        ]);
    });

    /**
     * The ends are what say good and bad, so they stay put however many ranges lie between them: a
     * gauge split in three has to be read against one split in six.
     */
    it('keeps the ends of the scale wherever the ranges are split', () => {
        for (const count of [2, 3, 6, 9]) {
            const colors = segmentColors(count, 'high');

            expect(`${count}: ${colors.length} from ${colors[0]} to ${colors[colors.length - 1]}`).toEqual(`${count}: ${count} from #ed6e6e to #84bb4c`);
        }
    });

    /** The two meters share one scale, so the same shade means the same thing on both of them. */
    it('reads the same scale from either end', () => {
        expect(segmentColors(6, 'low')).toEqual([...segmentColors(6, 'high')].reverse());
    });

    it('uses the pie settings for a pie, which ignores the graph ones', () => {
        const settings = buildVisualizationSettings(card({ display: 'pie', dimensions: ['Geslacht'], metrics: ['Aantal leden'] }));

        expect(settings['pie.dimension']).toEqual('Geslacht');
        expect(settings['graph.dimensions']).toBeUndefined();
    });

    /**
     * A slice and a bar of the same geslacht are the same color, on whichever page they stand. The
     * two displays hang a color on different things -- a pie has a slice per value, a chart a series
     * -- so the palette is written twice over in Metabase's words and once here.
     */
    it('colors the geslachten the same in a pie and in a chart', () => {
        const colors = columnPalettes.get('Geslacht')!;

        expect(buildVisualizationSettings(card({ display: 'pie', dimensions: ['Geslacht'], metrics: ['Aantal leden'] }))['pie.colors']).toEqual(colors);
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Scoutsjaar', 'Geslacht'], metrics: ['Aantal leden'] }))['series_settings'])
            .toEqual({ Man: { color: colors.Man }, Vrouw: { color: colors.Vrouw }, Andere: { color: colors.Andere }, Onbekend: { color: colors.Onbekend } });
    });

    /**
     * The colors of the platform the report is written for, which is what a chart falls back to. By
     * position for the series that are values in the data, and by name for the ones that are metrics
     * -- the only colors a row chart reads.
     */
    it('draws a chart in the colors of the platform it is written for', () => {
        const chart = card({ display: 'bar', dimensions: ['Scoutsjaar'], metrics: ['Aantal kinderen', 'Aantal leiding'] });

        const keeo = buildVisualizationSettings(chart, true, 'keeo');
        expect((keeo['graph.colors'] as string[]).slice(0, 3)).toEqual(['#00549E', '#C7DD06', '#FF5797']);
        expect(keeo['series_settings']).toEqual({ 'Aantal kinderen': { color: '#00549E' }, 'Aantal leiding': { color: '#C7DD06' } });

        const ravot = buildVisualizationSettings(chart, true, 'ravot');
        expect((ravot['graph.colors'] as string[]).slice(0, 3)).toEqual(['#0067B1', '#EF3E42', '#ED7D34']);
    });

    /** A platform the report is not written for has no colors of its own to fall back to. */
    it('leaves a chart of an unknown platform in Metabase\'s colors', () => {
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Tak'], metrics: ['A'] }), true, 'ergens')).not.toHaveProperty('graph.colors');
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Tak'], metrics: ['A'] }))).not.toHaveProperty('graph.colors');
    });

    /**
     * The platform's colors are what a series falls back to, so a card that says what a value is
     * drawn in keeps saying it: Metabase reads `graph.colors` only where nothing else colored the
     * series, and the metrics of a chart that splits on a column are not its series at all.
     */
    it('keeps the colors a card already names over the ones of the platform', () => {
        const settings = buildVisualizationSettings(card({ display: 'bar', dimensions: ['Scoutsjaar', 'Geslacht'], metrics: ['Aantal kinderen'] }), true, 'keeo');
        const colors = columnPalettes.get('Geslacht')!;

        expect(settings['series_settings']).toEqual({
            Man: { color: colors.Man }, Vrouw: { color: colors.Vrouw }, Andere: { color: colors.Andere }, Onbekend: { color: colors.Onbekend },
        });
        expect(settings).toHaveProperty('graph.colors');
    });

    /**
     * A chart with more series than the platform has colors gets shades of the same three: repeating
     * one would draw two of them as if they were one series.
     */
    it('shades the platform colors for a chart with more series than colors', () => {
        const colors = chartColors(environmentColors.get('keeo')!);

        expect(colors.slice(0, 3)).toEqual(['#00549E', '#C7DD06', '#FF5797']);
        expect(`${colors.length} colors, ${new Set(colors).size} of them different`).toEqual('12 colors, 12 of them different');
    });

    it('leaves a card that splits on something the palette says nothing about to Metabase', () => {
        expect(buildVisualizationSettings(card({ display: 'pie', dimensions: ['Tak'], metrics: ['Aantal leden'] }))).not.toHaveProperty('pie.colors');
        expect(buildVisualizationSettings(card({ display: 'bar', dimensions: ['Scoutsjaar', 'Tak'], metrics: ['Aantal leden'] }))).not.toHaveProperty('series_settings');
    });

    /** The one chart that splits on both: the shapes it needs cannot cost it the colors it needs. */
    it('gives a combo chart its shapes and its colors at once', () => {
        const settings = buildVisualizationSettings(card({ display: 'combo', dimensions: ['Scoutsjaar', 'Geslacht'], metrics: ['Aantal leden', 'GTP index'] }));

        expect(settings['series_settings']).toMatchObject({
            Man: { color: columnPalettes.get('Geslacht')!.Man },
            'Aantal leden': { display: 'bar' },
            'GTP index': { display: 'line' },
        });
    });
});

describe('buildTemplateTags', () => {
    it('declares a tag for every parameter the query uses', () => {
        const tags = buildTemplateTags(card({ parameters: ['scoutsjaar'] }), new Map(), []) as Record<string, { name: string; type: string; 'display-name': string }>;

        expect(tags.scoutsjaar).toMatchObject({ name: 'scoutsjaar', type: 'text', 'display-name': 'Scoutsjaar' });
    });

    /**
     * A nested fragment is looked up among the tags of the question that is running, not among those
     * of the fragment referring to it, so the card declares what it only reaches through another one.
     */
    it('points a tag at every fragment the card reads, the nested ones included', () => {
        const tags = buildTemplateTags(card({ snippets: ['facts', 'takken'] }), new Map([['facts', 7], ['takken', 9]]), []) as Record<string, unknown>;

        expect(Object.keys(tags)).toEqual(['snippet: facts', 'snippet: takken']);
        expect(tags['snippet: takken']).toMatchObject({ name: 'snippet: takken', type: 'snippet', 'snippet-name': 'takken', 'snippet-id': 9 });
    });

    /** A tag pointing at no snippet is a parameter Metabase cannot find, halfway through the report. */
    it('refuses a card whose fragment was not written as a snippet', () => {
        expect(() => buildTemplateTags(card({ snippets: ['facts'] }), new Map(), [])).toThrow('reads the fragment "facts"');
    });

    it('names a snippet tag the way Metabase writes the reference', () => {
        expect(snippetTagName('ingeschreven-voor')).toEqual('snippet: ingeschreven-voor');
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

describe('syncSnippets', () => {
    function stubApi(existing: { id: number; name: string }[]) {
        const written: { name: string; existingId: number | undefined }[] = [];
        const api = {
            listSnippets: async () => existing.map(snippet => ({ ...snippet, content: '' })),
            saveSnippet: async (input: { name: string }, existingId?: number) => {
                written.push({ name: input.name, existingId });
                return existingId ?? 100 + written.length;
            },
        };

        return { api: api as unknown as MetabaseApi, written };
    }

    /** A fragment keeps the id its questions point at, so an edit reaches them instead of orphaning them. */
    it('updates a fragment that is already there and creates the rest', async () => {
        const { api, written } = stubApi([{ id: 4, name: 'facts' }]);

        const ids = await syncSnippets(api, [{ name: 'facts', sql: 'SELECT 1' }, { name: 'leden', sql: 'SELECT 2' }]);

        expect(written).toEqual([{ name: 'facts', existingId: 4 }, { name: 'leden', existingId: undefined }]);
        expect(ids.get('facts')).toBe(4);
        expect(ids.get('leden')).toBe(102);
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

    /**
     * Metabase leaves a filter that drives a query variable on a single value unless the parameter
     * says otherwise, and both filters the report still shows are taken with an `=`: a second value
     * would land beside it as sql the card cannot parse. `multiple` is what a filter taken with an
     * `IN` would say instead.
     */
    it('holds both filters to one value, which is what their cards take', () => {
        const entry = [tab({ filters: ['scoutsjaar', 'eenheid'], cards: [card({ parameters: ['scoutsjaar', 'eenheid'] })] })];

        const parameters = buildParameters(entry, new Map());

        expect(parameters.map(parameter => [parameter.slug, parameter.isMultiSelect])).toEqual([['scoutsjaar', false], ['eenheid', false]]);
    });

    /**
     * Nothing chosen is what counts every member, so the filters open empty: a default would leave the
     * dashboards showing a slice of the platform to whoever does not look at the filter bar.
     */
    it('gives no filter a value to start from where empty counts everyone', () => {
        const entry = [tab({ filters: ['scoutsjaar', 'eenheid'], cards: [card({ parameters: ['scoutsjaar', 'eenheid'] })] })];

        const started = buildParameters(entry, new Map()).filter(parameter => parameter.default !== undefined);

        expect(started.map(parameter => parameter.slug)).toEqual([]);
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
