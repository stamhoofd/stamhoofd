import type { MetabaseApi } from './api.js';
import { isLegacyReportCollectionName } from './naming.js';
import type { ReportCard, ReportCardBest, ReportSnippet, ReportTab } from './report.js';

/**
 * Turns the report definition of `report.ts` into one Metabase dashboard, with a tab per page of the
 * client's report.
 *
 * This file only knows how to say the queries in Metabase's vocabulary: which display, which columns
 * on which axis, and which filter drives which card.
 *
 * Everything here is written by name and updated in place, so running it twice changes nothing and
 * running it after an edit only moves what actually changed.
 */

/**
 * The filters shown above the dashboards. `valuesFrom` names the card in the hidden `filters`
 * dashboard that fills the dropdown, and `column` the column to read the values from.
 *
 * `keepOrder` says the order of that card matters. Metabase sorts a dropdown fed by a question
 * alphabetically whatever the question's ORDER BY says, so the scoutsjaren would run oldest first.
 * Those filters get the values written out as a fixed list instead, which Metabase leaves alone —
 * at the cost of being a snapshot, so a new scoutsjaar appears once the report is written again.
 * Unit names read fine alphabetically and stay on the live question.
 *
 * `multiple` is whether several values can be picked at once. Metabase writes those out comma
 * separated, so a query takes such a filter as `IN ({{name}})` and one without as `= {{name}}`. It
 * is said here for every filter rather than only where it is on, because a filter that drives a
 * variable is single-select unless told otherwise, and a second value would land beside the `=` of
 * the others as sql they cannot parse.
 *
 * `start` is what a filter is set to when a dashboard is opened. Only one filter has any: the others
 * count every member while nothing is chosen, and a value to start from would show whoever does not
 * read the filter bar a slice of the platform. "Ingeschreven voor" is the other way round -- empty
 * counts the wachtlijsten and the activiteiten along with the leden -- so it opens on the
 * leeftijdsgroepen, which is what the ledenstatistieken are read as.
 */
export type ReportFilter = {
    name: string;
    title: string;
    valuesFrom: string;
    column: string;
    keepOrder: boolean;
    multiple: boolean;
    start?: string[];
};

export const reportFilters: readonly ReportFilter[] = [
    { name: 'scoutsjaar', title: 'Scoutsjaar', valuesFrom: 'scoutsjaar', column: 'Scoutsjaar', keepOrder: false, multiple: false },
    { name: 'eenheid', title: 'Eenheid', valuesFrom: 'eenheid', column: 'Eenheid', keepOrder: false, multiple: false },
    { name: 'aansluiting', title: 'Aansluiting', valuesFrom: 'aansluiting', column: 'Aansluiting', keepOrder: false, multiple: true },
    { name: 'ingeschreven_voor', title: 'Ingeschreven voor', valuesFrom: 'ingeschreven-voor', column: 'Ingeschreven voor', keepOrder: true, multiple: true, start: ['Leeftijdsgroepen'] },
];

/**
 * What a question is called in the collection.
 *
 * Qualified with its tab because a title is not unique — the report shows "Aantal leden per postcode"
 * on two pages, as the client's own does — and questions are matched by name to be updated in place.
 * Two of them sharing a name means one silently overwrites the other. The dashboard still shows the
 * plain title: that comes from the card's own `card.title` setting.
 */
export function cardName(card: ReportCard, tab: ReportTab): string {
    return `${card.title} (${tab.title})`;
}

/** Metabase lays a dashboard out on a 24 column grid. */
const gridWidth = 24;

const widths: Record<ReportCard['size'], number> = { full: 24, 'two-thirds': 16, half: 12, third: 8, quarter: 6, sixth: 4 };

/**
 * Extra rows for the band the rotated labels sit in.
 *
 * Rotated labels are drawn below the plot and eat into it, which leaves a card at the normal height
 * with bars too short to tell apart. The band is as tall as the longest label, which has nothing to
 * do with how wide the card is, so this is added on top rather than scaled.
 */
const xLabelRows: Record<NonNullable<ReportCard['xLabels']>, number> = {
    show: 0,
    hide: 0,
    compact: 0,
    'rotate-45': 4,
    'rotate-90': 6,
};

function heightOf(card: ReportCard): number {
    if (card.height !== undefined) {
        return card.height;
    }
    if (card.display === 'scalar') {
        return 3;
    }
    // A gauge stands next to the chart of the same figure over the years, and only sits level with it
    // at the height of a chart.
    if (card.display === 'gauge') {
        return 6;
    }
    if (card.display === 'table') {
        return 8;
    }
    // A row chart is as tall as the rows it has to hold: Metabase gives each of them 24 pixels and
    // silently drops the ones that no longer fit, so a row chart at the height of a normal chart
    // would quietly stop showing the oldest scoutsjaren as the years pile up. Ten grid rows hold
    // some eighteen of them.
    if (card.display === 'row') {
        return 10;
    }
    return (card.size === 'full' ? 7 : 6) + (card.xLabels === undefined ? 0 : xLabelRows[card.xLabels]);
}

/** A row of the page while it is being filled: which columns are taken, and how tall it ended up. */
type LayoutRow = { taken: { col: number; sizeX: number }[]; height: number };

/**
 * Places the cards left to right in the order the report lists them, wrapping to a new row when the
 * next one no longer fits.
 *
 * A row is as tall as its tallest card and every card in it is drawn that tall, so the row ends on
 * one line. The cards of a row are two readings of one thing -- the geslachten as a pie beside the
 * geslachten over the years -- and one of them stopping halfway leaves a hole under it that the row
 * below cannot fill.
 *
 * A card that spans rows keeps its columns in the rows below it, which the cards after it wrap
 * around, and ends up as tall as those rows together: the netwerk map stands beside the chart and
 * the pie stacked next to it. It does not decide how tall those rows are -- the cards stacked beside
 * it do, which is what makes it end exactly where they do.
 */
export function layoutCards(cards: ReportCard[]): { card: ReportCard; row: number; col: number; sizeX: number; sizeY: number }[] {
    const rows: LayoutRow[] = [];
    const placed: { card: ReportCard; index: number; col: number; sizeX: number }[] = [];
    let index = 0;

    const rowAt = (position: number): LayoutRow => {
        while (rows.length <= position) {
            rows.push({ taken: [], height: 0 });
        }
        return rows[position];
    };

    for (const card of cards) {
        const sizeX = widths[card.size];
        let col = freeColumn(rowAt(index), sizeX);

        while (col === undefined) {
            index += 1;
            col = freeColumn(rowAt(index), sizeX);
        }

        for (let offset = 0; offset < card.span; offset++) {
            rowAt(index + offset).taken.push({ col, sizeX });
        }

        // Only what a row holds on its own decides how tall it is. A card spanning several still has
        // to fit in them, so it asks each for its share -- which is what a row holding nothing else
        // ends up at.
        const height = card.span === 1 ? heightOf(card) : Math.ceil(heightOf(card) / card.span);
        for (let offset = 0; offset < card.span; offset++) {
            rowAt(index + offset).height = Math.max(rowAt(index + offset).height, height);
        }

        placed.push({ card, index, col, sizeX });
    }

    const tops = rows.reduce<number[]>((offsets, row, position) => [...offsets, offsets[position] + row.height], [0]);

    return placed.map(entry => ({
        card: entry.card,
        row: tops[entry.index],
        col: entry.col,
        sizeX: entry.sizeX,
        sizeY: tops[entry.index + entry.card.span] - tops[entry.index],
    }));
}

/** The leftmost column a card of this width still fits at, or nothing when the row is full. */
function freeColumn(row: LayoutRow, sizeX: number): number | undefined {
    for (let col = 0; col + sizeX <= gridWidth; col++) {
        if (row.taken.every(entry => col + sizeX <= entry.col || entry.col + entry.sizeX <= col)) {
            return col;
        }
    }
    return undefined;
}

/**
 * Metabase identifies a template tag by a uuid that has to stay the same between runs, otherwise
 * every filter connection is rebuilt on each push. Derived from the card and parameter name so it is
 * stable without having to be stored anywhere.
 */
export function templateTagId(cardKey: string, parameter: string): string {
    const seed = `${cardKey}:${parameter}`;
    let hash = 0;
    for (const character of seed) {
        hash = (Math.imul(hash, 31) + character.codePointAt(0)!) | 0;
    }

    const hex = (Math.abs(hash) >>> 0).toString(16).padStart(8, '0');
    return `${hex}-0000-4000-8000-${hex}00000000`.slice(0, 36);
}

/**
 * What a fragment is called where a question refers to it. Metabase writes the reference as
 * `{{snippet: leden}}` and keys the template tag by everything between the braces, so the tag of a
 * snippet carries the word as well as the name.
 */
export function snippetTagName(snippet: string): string {
    return `snippet: ${snippet}`;
}

/**
 * The tags a question declares: one per fragment it reads and one per filter it takes.
 *
 * A snippet is pointed at by id, which is why the fragments have to be written before the questions
 * that read them. Every fragment the card reaches is declared, the ones it only reaches through
 * another one included: Metabase resolves a nested reference against the tags of the question it is
 * running, so a fragment left out here is a parameter it cannot find rather than one it looks up in
 * the snippet that refers to it.
 */
export function buildTemplateTags(card: ReportCard, snippetIds: Map<string, number>): Record<string, unknown> {
    const tags: Record<string, unknown> = {};

    for (const snippet of card.snippets) {
        const snippetId = snippetIds.get(snippet);
        if (snippetId === undefined) {
            throw new Error(`Card "${card.key}" reads the fragment "${snippet}", which was not written as a snippet`);
        }

        const name = snippetTagName(snippet);
        tags[name] = {
            id: templateTagId(card.key, name),
            name,
            'display-name': snippet,
            type: 'snippet',
            'snippet-name': snippet,
            'snippet-id': snippetId,
        };
    }

    for (const parameter of card.parameters) {
        const filter = reportFilters.find(entry => entry.name === parameter);
        tags[parameter] = {
            id: templateTagId(card.key, parameter),
            name: parameter,
            'display-name': filter?.title ?? parameter,
            type: 'text',
        };
    }

    return tags;
}

/**
 * What Metabase actually draws. A map needs a coordinate per postal code, and those are loaded
 * separately from anything Stamhoofd holds; while `postal_codes` is empty the card is a bar chart of
 * the same figures rather than an empty map.
 */
export function effectiveDisplay(card: ReportCard, hasCoordinates: boolean): string {
    return card.display === 'map' && !hasCoordinates ? 'bar' : card.display;
}

/**
 * The scale the ranges of a figure are colored along: red where it is at its worst, green where it is
 * at its best, through the yellow that lies between them. Metabase's own three, so these cards sit
 * beside the rest of the report rather than beside a palette of their own.
 */
const segmentScale = ['#ED6E6E', '#F9CF48', '#84BB4C'];

/**
 * The color of each range, mixed along that scale rather than picked per range: the ranges of a
 * figure are read against each other, so what a color says has to be where it sits between the worst
 * and the best -- whether a card splits the figure in three or in six.
 *
 * A figure that is better the lower it is runs the scale the other way, which is the whole of the
 * difference between the two figures of the page: green is always the end an eenheid is doing well at.
 */
export function segmentColors(count: number, best: ReportCardBest): string[] {
    const colors = [...new Array(count).keys()].map((index) => {
        const position = count === 1 ? 0 : (index / (count - 1)) * (segmentScale.length - 1);
        const step = Math.min(Math.floor(position), segmentScale.length - 2);

        return mixColors(segmentScale[step], segmentScale[step + 1], position - step);
    });

    return best === 'low' ? colors.reverse() : colors;
}

function mixColors(from: string, to: string, ratio: number): string {
    const channels = [0, 1, 2].map((channel) => {
        const start = Number.parseInt(from.slice(1 + channel * 2, 3 + channel * 2), 16);
        const end = Number.parseInt(to.slice(1 + channel * 2, 3 + channel * 2), 16);

        return Math.round(start + (end - start) * ratio).toString(16).padStart(2, '0');
    });

    return `#${channels.join('')}`;
}

/**
 * What a range is called under the gauge. The two outer ones say where they open rather than where
 * they end: they are as long as the arc has room for, and an eenheid twice over the highest boundary
 * is read in the same range as one just above it.
 */
function gaugeLabel(segments: number[], index: number): string {
    if (index === 0) {
        return `< ${segments[1]}`;
    }
    if (index === segments.length - 2) {
        return `> ${segments[index]}`;
    }
    return `${segments[index]}-${segments[index + 1]}`;
}

/**
 * The ranges of a figure as the display reading them says it. The colors are the same either way --
 * the number at the top of the page and the meter below it are read together -- but the ends are
 * not. An arc has to stop somewhere, while a number has nowhere to run out of: leaving its outer
 * ranges open is what keeps an eenheid past the last boundary colored at all, instead of falling
 * outside every range and being drawn in the plain text color exactly where it matters most.
 *
 * Only the arc carries labels. Under a number Metabase writes each range beside its own color.
 */
function buildSegments(card: ReportCard, display: 'gauge' | 'scalar'): Record<string, unknown>[] {
    const colors = segmentColors(card.segments.length - 1, card.best);

    return card.segments.slice(0, -1).map((min, index) => {
        const open = display === 'scalar';
        const last = index === card.segments.length - 2;

        return {
            ...(open && index === 0 ? {} : { min }),
            ...(open && last ? {} : { max: card.segments[index + 1] }),
            color: colors[index],
            ...(display === 'gauge' ? { label: gaugeLabel(card.segments, index) } : {}),
        };
    });
}

/**
 * The colors the values of a column are drawn in, wherever a card splits on it.
 *
 * Kept by the column rather than by the card because the same split stands on several pages -- the
 * geslachten are a pie on two of them and the bars of a third -- and someone reading two pages side
 * by side reads the colors before the legend. A value the palette does not name keeps whichever
 * color Metabase gives it.
 */
export const columnPalettes = new Map<string, Record<string, string>>([
    ['Geslacht', {
        Man: '#0892D0',
        Vrouw: '#DE8A8A',
        Andere: '#8A2BE2',
        Onbekend: '#949AAB',
    }],
]);

/**
 * The colors a chart falls back to, per platform: the ones the platform shows itself in everywhere
 * else. A chart takes them for the series nothing else has colored -- a column palette colors first,
 * and a card that says its own colors keeps them -- which is what makes these the default rather
 * than the colors. A platform the report is not written for keeps Metabase's own palette.
 *
 * Said per card because the setting that colors every chart of an instance at once,
 * `application-colors`, is a paid feature. An instance serves one platform anyway.
 */
export const environmentColors = new Map<string, string[]>([
    ['keeo', ['#00549E', '#C7DD06', '#FF5797']],
    ['ravot', ['#0067B1', '#EF3E42', '#ED7D34']],
]);

/** How many series a chart is handed colors for before Metabase's own palette takes over. */
const chartColorCount = 12;

/**
 * The platform's colors, and after them the same ones lightened and darkened.
 *
 * A chart with more series than the platform has colors has to get them from somewhere: repeating
 * one draws two takken as if they were one, and stopping after three leaves the rest of the legend in
 * Metabase's palette, which reads as a chart drawn in two sets of colors. Shades of the three stay
 * the platform's own.
 */
export function chartColors(colors: string[], count = chartColorCount): string[] {
    // Towards white where positive, towards black where negative, and the platform's own where zero.
    const shades = [0, 0.35, -0.3, 0.6, -0.55];

    return [...new Array(count).keys()].map((index) => {
        const color = colors[index % colors.length];
        const shade = shades[Math.floor(index / colors.length) % shades.length];

        return shade === 0 ? color : mixColors(color, shade > 0 ? '#FFFFFF' : '#000000', Math.abs(shade));
    });
}

/**
 * How the report describes its x-axis labels, in what Metabase calls them.
 */
const xAxisLabels: Record<string, boolean | string> = {
    show: true,
    hide: false,
    compact: 'compact',
    'rotate-45': 'rotate-45',
    'rotate-90': 'rotate-90',
};

export function buildVisualizationSettings(card: ReportCard, hasCoordinates = true, env?: string): Record<string, unknown> {
    const settings: Record<string, unknown> = { 'card.title': card.title };

    if (card.description !== undefined) {
        settings['card.description'] = card.description;
    }

    // What the header of an export reads. Metabase writes it from the column's title and falls back
    // to what it makes of the alias itself, which is not what a sheet delivered to a government
    // department may be called. Keyed by name rather than by field, the way a native query's columns
    // are addressed; a key matching no column is ignored, so a renamed column loses its title
    // instead of dropping the sheet's other columns.
    if (card.columns.length > 0) {
        settings['column_settings'] = Object.fromEntries(card.columns.map(column => [JSON.stringify(['name', column]), { column_title: column }]));
    }

    const display = effectiveDisplay(card, hasCoordinates);

    if (display === 'map') {
        // A pin map, which needs nothing but the two coordinate columns: Metabase only knows the
        // outlines of countries and US states, and a map of Belgian postal code areas would mean
        // hosting a GeoJSON on a public url for it to fetch.
        settings['map.type'] = 'pin';
        settings['map.latitude_column'] = card.latitude;
        settings['map.longitude_column'] = card.longitude;
        return settings;
    }

    if (display === 'gauge') {
        // Left unsaid, Metabase splits the arc in three equal ranges of its own between 0 and the
        // value it first drew, which says nothing about whether the figure is a good one.
        if (card.segments.length > 0) {
            settings['gauge.segments'] = buildSegments(card, 'gauge');
        }
        return settings;
    }

    if (display === 'scalar') {
        // The figure at the top of the page in the color of the range it falls in, so it says what
        // the meter further down says without having to be read against it.
        if (card.segments.length > 0) {
            settings['scalar.segments'] = buildSegments(card, 'scalar');
        }
        return settings;
    }

    if (display === 'pie') {
        settings['pie.dimension'] = card.dimensions[0];
        settings['pie.metric'] = card.metrics[0];

        // Keyed by the value of the dimension, which is what a slice is: the pie has no series to
        // hang a color on the way a bar chart does.
        const palette = columnPalettes.get(card.dimensions[0]);
        if (palette !== undefined) {
            settings['pie.colors'] = palette;
        }
        return settings;
    }

    if (['bar', 'line', 'combo', 'area', 'row'].includes(display)) {
        settings['graph.dimensions'] = card.dimensions;
        settings['graph.metrics'] = card.metrics;

        // Left unset, Metabase decides for itself and drops the labels when too many do not fit --
        // which is every chart with a bar per eenheid. An explicit value is used as given.
        if (card.xLabels !== undefined) {
            settings['graph.x_axis.axis_enabled'] = xAxisLabels[card.xLabels];
        }

        if (card.stacked !== undefined) {
            settings['stackable.stack_type'] = card.stacked === 'normalized' ? 'normalized' : 'stacked';
        }

        // Under `series_settings` -- one of the few settings without the `graph.` prefix, and an
        // unknown key is dropped without a word. A chart with a second dimension draws a series per
        // value of it, keyed by the value itself; one without draws a series per metric, keyed by
        // the column name.
        const series: Record<string, Record<string, unknown>> = Object.fromEntries(
            Object.entries(columnPalettes.get(card.dimensions[1]) ?? {}).map(([value, color]) => [value, { color }]),
        );

        const platform = env === undefined ? undefined : environmentColors.get(env);
        if (platform !== undefined) {
            const colors = chartColors(platform);

            // By position, since the series of a chart that splits on a column are its values, which
            // are in the data rather than in the report. Metabase reads them only where nothing else
            // colored that series.
            settings['graph.colors'] = colors;

            // A chart without a second dimension draws a series per metric, and a metric has a name
            // this can hand a color to. It is also the only place a row chart reads a color: that
            // one colors by series name and never looks at `graph.colors`.
            if (card.dimensions.length < 2) {
                for (const [index, metric] of card.metrics.entries()) {
                    series[metric] = { ...series[metric], color: colors[index] };
                }
            }
        }

        // Left to itself a combo chart draws its first series as a line and the rest as bars, the
        // other way round from what the "aantal leden + GTP index" chart needs, so every series is
        // given its own shape.
        if (display === 'combo') {
            for (const [index, metric] of card.metrics.entries()) {
                series[metric] = { ...series[metric], display: index === 0 ? 'bar' : 'line' };
            }
        }

        if (Object.keys(series).length > 0) {
            settings['series_settings'] = series;
        }
    }

    return settings;
}

/**
 * The filters shown above the dashboard: every one that any tab asks for.
 *
 * Metabase puts filters above the whole dashboard rather than on a tab, so a filter named by one tab
 * is visible on all of them. Which cards it actually reaches is decided per tab in `buildDashcards`,
 * so the Eenheid filter cannot quietly turn the national figures into one unit's.
 */
export function buildParameters(tabs: ReportTab[], filterCardIds: Map<string, number>, orderedValues: Map<string, string[]> = new Map()): Record<string, unknown>[] {
    const wanted = new Set(tabs.flatMap(tab => tab.filters));

    return reportFilters
        .filter(filter => wanted.has(filter.name))
        .map((filter) => {
            const cardId = filterCardIds.get(filter.valuesFrom);
            const values = filter.keepOrder ? orderedValues.get(filter.valuesFrom) : undefined;

            return {
                id: templateTagId('dashboard', filter.name).slice(0, 8),
                name: filter.title,
                slug: filter.name,
                type: 'string/=',
                sectionId: 'string',
                isMultiSelect: filter.multiple,
                // Without this the widget is a plain text box, however well the values source is
                // configured: it is what picks the dropdown over an input box.
                values_query_type: 'list',
                // A list even where one value is chosen: a multi-select filter hands its cards every
                // value it holds, and a bare string is read as a filter holding none.
                ...(filter.start === undefined ? {} : { default: filter.start }),
                ...buildValuesSource(filter.column, cardId, values),
            };
        });
}

/**
 * Where a dropdown gets its values. A fixed list when the order matters and the values are known,
 * otherwise the question itself, which keeps the list up to date on its own.
 */
function buildValuesSource(column: string, cardId: number | undefined, values: string[] | undefined): Record<string, unknown> {
    if (values !== undefined && values.length > 0) {
        return { values_source_type: 'static-list', values_source_config: { values } };
    }
    if (cardId === undefined) {
        return {};
    }
    return {
        values_source_type: 'card',
        values_source_config: {
            card_id: cardId,
            value_field: ['field', column, { 'base-type': 'type/Text' }],
        },
    };
}

/**
 * The tabs, in the order the report lists them. A tab that is already there keeps its id so links
 * into it survive; a new one gets a negative id, which is how Metabase is told to create it.
 */
export function buildTabs(tabs: ReportTab[], existing: Map<string, number>): { id: number; name: string; position: number }[] {
    return tabs.map((tab, position) => ({
        id: existing.get(tab.title) ?? -(position + 1),
        name: tab.title,
        position,
    }));
}

/**
 * Where each card of the report sits on the dashboard.
 *
 * `existing` holds the placed cards the dashboard already has, keyed by tab and card, so a card that
 * is still there keeps the id it was placed under. Metabase addresses a card on a dashboard by that
 * id: giving out new ones on every run leaves anyone with the dashboard open asking for placements
 * that no longer exist, and every card on their screen answers 404 until they load the page again.
 */
/** How a placed card is recognised between two runs: the same card on the same tab. */
export function dashcardKey(tabId: number | null | undefined, cardId: number | null): string {
    return `${tabId ?? ''}:${cardId ?? ''}`;
}

export function buildDashcards(tabs: ReportTab[], cardIds: Map<string, number>, parameters: Record<string, unknown>[], tabIds: Map<string, number>, existing: Map<string, number> = new Map()): Record<string, unknown>[] {
    const dashcards: Record<string, unknown>[] = [];
    const free = new Map(existing);

    for (const tab of tabs) {
        for (const placed of layoutCards(tab.cards)) {
            const cardId = cardIds.get(placed.card.key)!;
            const tabId = tabIds.get(tab.title);
            const key = dashcardKey(tabId, cardId);
            const id = free.get(key);
            // Only once: the same card placed twice on a tab is one placement that stays and one new.
            free.delete(key);

            dashcards.push({
                // Metabase reads a negative id as "this one is new".
                id: id ?? -1 - dashcards.length,
                card_id: cardId,
                dashboard_tab_id: tabId,
                row: placed.row,
                col: placed.col,
                size_x: placed.sizeX,
                size_y: placed.sizeY,
                visualization_settings: {},
                parameter_mappings: parameters
                    // A filter reaches a card only when its own tab asks for it and its query takes it.
                    .filter(parameter => tab.filters.includes(parameter.slug as string) && placed.card.parameters.includes(parameter.slug as string))
                    .map(parameter => ({
                        parameter_id: parameter.id,
                        card_id: cardId,
                        target: ['variable', ['template-tag', parameter.slug]],
                    })),
            });
        }
    }

    return dashcards;
}

export type ReportSyncDashboard = {
    name: string;
    id: number;
    /** The titles of the tabs it holds, in the order the report lists them. */
    tabs: string[];
    bookmarked: boolean;
};

export type ReportSyncResult = {
    collection: string;
    collectionId: number;
    createdCollection: boolean;
    /** The name the collection carried before this run renamed it, when it still had one. */
    renamedCollection: string | undefined;
    dashboards: ReportSyncDashboard[];
    cards: number;
    /** The shared fragments written as snippets, which the questions read instead of copying. */
    snippets: number;
    /** Map cards drawn as a bar chart because no postal code coordinates are loaded yet. */
    mapsWithoutCoordinates: string[];
};

/**
 * Where the first dashboard is pinned in its collection; the ones after it follow. Pinned because
 * the dashboards are the only things in there worth opening directly -- everything else in the
 * collection is a question one of them draws.
 */
export const reportCollectionPosition = 1;

/**
 * The dashboards to write and the tabs each of them holds, in the order the report lists them. A tab
 * lands on the report's own dashboard unless it names one, which is what gives a tab that mirrors no
 * page of the client's report -- the aanlevering to the department -- a dashboard of its own.
 */
export function groupByDashboard(tabs: ReportTab[], dashboardName: string): { name: string; tabs: ReportTab[] }[] {
    const dashboards: { name: string; tabs: ReportTab[] }[] = [];

    for (const tab of tabs) {
        const name = tab.dashboard ?? dashboardName;
        const dashboard = dashboards.find(entry => entry.name === name);

        if (dashboard) {
            dashboard.tabs.push(tab);
        }
        else {
            dashboards.push({ name, tabs: [tab] });
        }
    }

    return dashboards;
}

/**
 * Write the shared fragments as the snippets the questions refer to, and say which id each ended up
 * under. Matched by name and updated in place, so a fragment keeps the id the questions point at.
 *
 * Snippets live in the instance rather than in a collection, which is what makes them worth writing:
 * the definition of a lid stands in one place there as well, and whoever changes it changes every
 * question that counts one. That also means they are not this collection's to clear away -- a
 * fragment the report no longer has keeps its snippet, since anything the client has since built on
 * it would break with it.
 */
export async function syncSnippets(api: MetabaseApi, snippets: readonly ReportSnippet[]): Promise<Map<string, number>> {
    const existing = new Map((await api.listSnippets()).map(snippet => [snippet.name, snippet.id]));
    const ids = new Map<string, number>();

    for (const snippet of snippets) {
        ids.set(snippet.name, await api.saveSnippet({ name: snippet.name, content: snippet.sql }, existing.get(snippet.name)));
    }

    return ids;
}

/**
 * Write the whole report to Metabase: a dashboard with a tab per page, and one per tab that asked for
 * its own. Snippets first, because a question points at a fragment by id, then the cards, because a
 * dashboard can only point at cards that exist, and the filter dropdowns point at cards too.
 *
 * `env` is the platform being written, the same name the report was loaded for. It says which colors
 * a chart falls back to; without it they are Metabase's.
 */
export async function syncReport(api: MetabaseApi, databaseId: number, tabs: ReportTab[], snippets: readonly ReportSnippet[], collection: string, dashboardName: string, hasCoordinates = false, env?: string): Promise<ReportSyncResult> {
    const snippetIds = await syncSnippets(api, snippets);
    const renamedCollection = await renameLegacyCollection(api, collection);
    const { id: collectionId, created: createdCollection } = await api.ensureCollection(collection);

    const existingCards = new Map((await api.listCards(collectionId)).map(card => [card.name, card.id]));
    const cardIds = new Map<string, number>();
    const filterCardIds = new Map<string, number>();

    for (const tab of tabs) {
        for (const card of tab.cards) {
            const id = await api.saveCard({
                name: cardName(card, tab),
                description: card.description,
                display: effectiveDisplay(card, hasCoordinates),
                databaseId,
                query: card.snippetSql,
                templateTags: buildTemplateTags(card, snippetIds),
                visualizationSettings: buildVisualizationSettings(card, hasCoordinates, env),
                collectionId,
            }, existingCards.get(cardName(card, tab)));

            cardIds.set(card.key, id);
            if (tab.hidden) {
                filterCardIds.set(card.key, id);
            }
        }
    }

    const visible = tabs.filter(tab => !tab.hidden);
    const orderedValues = await readOrderedValues(api, filterCardIds);
    const existingDashboards = await api.listDashboards(collectionId);
    const written: ReportSyncDashboard[] = [];

    for (const [index, dashboard] of groupByDashboard(visible, dashboardName).entries()) {
        const dashboardId = existingDashboards.find(entry => entry.name === dashboard.name)?.id
            ?? await api.createDashboard(dashboard.name, undefined, collectionId);

        const layout = await api.getDashboardLayout(dashboardId);
        const existingTabs = new Map(layout.tabs.map(tab => [tab.name, tab.id]));
        const existingDashcards = new Map(layout.cards.map(placed => [dashcardKey(placed.tabId, placed.cardId), placed.id]));
        const parameters = buildParameters(dashboard.tabs, filterCardIds, orderedValues);
        const dashboardTabs = buildTabs(dashboard.tabs, existingTabs);
        const tabIds = new Map(dashboardTabs.map(tab => [tab.name, tab.id]));

        await api.updateDashboard(dashboardId, {
            name: dashboard.name,
            parameters,
            tabs: dashboardTabs,
            dashcards: buildDashcards(dashboard.tabs, cardIds, parameters, tabIds, existingDashcards),
            // Pinned in the order the report writes them, so the pages the client knows stay first.
            collectionPosition: reportCollectionPosition + index,
        });

        const { created: bookmarked } = await api.bookmarkDashboard(dashboardId);
        written.push({ name: dashboard.name, id: dashboardId, tabs: dashboard.tabs.map(tab => tab.title), bookmarked });
    }

    await archiveSupersededDashboards(api, existingDashboards, visible, written.map(dashboard => dashboard.name));
    await archiveSupersededCards(api, collectionId, tabs);

    // Deduplicated: two tabs show a map under the same title, and naming it twice reads as an error.
    const mapsWithoutCoordinates = [...new Set(tabs
        .flatMap(tab => tab.cards)
        .filter(card => card.display === 'map' && !hasCoordinates)
        .map(card => card.title))];

    return { collection, collectionId, createdCollection, renamedCollection, dashboards: written, cards: cardIds.size, snippets: snippetIds.size, mapsWithoutCoordinates };
}

/**
 * The collection to rename into the one written now: the one this wrote while collections were named
 * per environment. Renaming keeps its id, and with it every question, dashboard, link and bookmark
 * that points into it, where writing a new collection would leave all of that behind.
 *
 * Only when exactly one is left, which is every instance that serves one platform. A development
 * machine that served several has no single right answer, so it gets a new collection and can throw
 * the old ones away itself.
 */
export function collectionToRename(collections: { id: number; name: string }[], name: string): { id: number; name: string } | undefined {
    if (collections.some(collection => collection.name === name)) {
        return undefined;
    }

    const legacy = collections.filter(collection => isLegacyReportCollectionName(collection.name));
    return legacy.length === 1 ? legacy[0] : undefined;
}

async function renameLegacyCollection(api: MetabaseApi, name: string): Promise<string | undefined> {
    const legacy = collectionToRename(await api.listCollections(), name);
    if (!legacy) {
        return undefined;
    }

    await api.renameCollection(legacy.id, name);
    return legacy.name;
}

/**
 * Clear away questions this command wrote earlier that the report no longer has: a renamed card, a
 * removed one, or one left behind by the older naming that did not qualify a title with its tab.
 *
 * Only names this command could have produced are touched, so a question the client saved into the
 * collection themselves stays where it is.
 */
async function archiveSupersededCards(api: MetabaseApi, collectionId: number, tabs: ReportTab[]): Promise<void> {
    const wanted = new Set(tabs.flatMap(tab => tab.cards.map(card => cardName(card, tab))));
    const ours = new Set(tabs.flatMap(tab => tab.cards.map(card => card.title)));
    const tabTitles = tabs.map(tab => tab.title);

    for (const card of await api.listCards(collectionId)) {
        if (wanted.has(card.name)) {
            continue;
        }

        const qualified = tabTitles.some(title => card.name.endsWith(` (${title})`));
        if (ours.has(card.name) || qualified) {
            await api.archiveCard(card.id);
        }
    }
}

/**
 * Clear away the dashboard-per-page layout an earlier version of this command left behind. Only
 * dashboards named exactly after a tab are touched, so anything the client built themselves stays,
 * and never one this run just wrote: a tab may share its name with the dashboard it asked for.
 */
async function archiveSupersededDashboards(api: MetabaseApi, existing: { id: number; name: string }[], tabs: ReportTab[], written: string[]): Promise<void> {
    const titles = new Set(tabs.map(tab => tab.title));
    const ours = new Set(written);

    for (const dashboard of existing.filter(dashboard => !ours.has(dashboard.name) && titles.has(dashboard.name))) {
        await api.archiveDashboard(dashboard.id);
    }
}

/**
 * Run the filter questions whose order has to be kept and remember what they returned.
 *
 * A question that cannot run yet — an empty statistics database, most likely — is not worth failing
 * the whole push for: that filter falls back to reading its values from the question, which costs
 * the ordering but keeps the dashboards working.
 */
async function readOrderedValues(api: MetabaseApi, filterCardIds: Map<string, number>): Promise<Map<string, string[]>> {
    const values = new Map<string, string[]>();

    for (const filter of reportFilters.filter(filter => filter.keepOrder)) {
        const cardId = filterCardIds.get(filter.valuesFrom);
        if (cardId === undefined) {
            continue;
        }

        try {
            values.set(filter.valuesFrom, await api.runCardValues(cardId));
        }
        catch {
            continue;
        }
    }

    return values;
}
