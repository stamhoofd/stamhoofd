import type { MetabaseApi } from './api.js';
import type { ReportCard, ReportTab } from './report.js';

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
 */
export const reportFilters = [
    { name: 'scoutsjaar', title: 'Scoutsjaar', valuesFrom: 'scoutsjaar', column: 'Scoutsjaar', keepOrder: true },
    { name: 'eenheid', title: 'Eenheid', valuesFrom: 'eenheid', column: 'Eenheid', keepOrder: false },
] as const;

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
    return (card.size === 'full' ? 7 : 6) + (card.xLabels === undefined ? 0 : xLabelRows[card.xLabels]);
}

/**
 * Places the cards left to right in the order the report lists them, wrapping to a new row when the
 * next one no longer fits. A row is as tall as its tallest card.
 */
export function layoutCards(cards: ReportCard[]): { card: ReportCard; row: number; col: number; sizeX: number; sizeY: number }[] {
    const placed: { card: ReportCard; row: number; col: number; sizeX: number; sizeY: number }[] = [];
    let row = 0;
    let col = 0;
    let rowHeight = 0;

    for (const card of cards) {
        const sizeX = widths[card.size];
        const sizeY = heightOf(card);

        if (col + sizeX > gridWidth) {
            row += rowHeight;
            col = 0;
            rowHeight = 0;
        }

        placed.push({ card, row, col, sizeX, sizeY });
        col += sizeX;
        rowHeight = Math.max(rowHeight, sizeY);
    }

    return placed;
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

export function buildTemplateTags(card: ReportCard): Record<string, unknown> {
    const tags: Record<string, unknown> = {};

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
 * How the report describes its x-axis labels, in what Metabase calls them.
 */
const xAxisLabels: Record<string, boolean | string> = {
    show: true,
    hide: false,
    compact: 'compact',
    'rotate-45': 'rotate-45',
    'rotate-90': 'rotate-90',
};

export function buildVisualizationSettings(card: ReportCard, hasCoordinates = true): Record<string, unknown> {
    const settings: Record<string, unknown> = { 'card.title': card.title };

    if (card.description !== undefined) {
        settings['card.description'] = card.description;
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

    if (display === 'pie') {
        settings['pie.dimension'] = card.dimensions[0];
        settings['pie.metric'] = card.metrics[0];
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
        // Left to itself a combo chart draws its first series as a line and the rest as bars, the
        // other way round from what the "aantal leden + GTP index" chart needs, so every series is
        // given its own shape. Keyed by column name, under `series_settings` -- one of the few
        // settings without the `graph.` prefix, and an unknown key is dropped without a word.
        if (display === 'combo') {
            settings['series_settings'] = Object.fromEntries(card.metrics.map((metric, index) => [metric, { display: index === 0 ? 'bar' : 'line' }]));
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
                // Without this the widget is a plain text box, however well the values source is
                // configured: it is what picks the dropdown over an input box.
                values_query_type: 'list',
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

export function buildDashcards(tabs: ReportTab[], cardIds: Map<string, number>, parameters: Record<string, unknown>[], tabIds: Map<string, number>): Record<string, unknown>[] {
    const dashcards: Record<string, unknown>[] = [];

    for (const tab of tabs) {
        for (const placed of layoutCards(tab.cards)) {
            const cardId = cardIds.get(placed.card.key)!;

            dashcards.push({
                // Metabase reads a negative id as "this one is new".
                id: -1 - dashcards.length,
                card_id: cardId,
                dashboard_tab_id: tabIds.get(tab.title),
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

export type ReportSyncResult = {
    collection: string;
    collectionId: number;
    createdCollection: boolean;
    dashboardId: number;
    cards: number;
    tabs: string[];
    bookmarked: boolean;
    /** Map cards drawn as a bar chart because no postal code coordinates are loaded yet. */
    mapsWithoutCoordinates: string[];
};

/** Pinned to the top of its collection: it is the only thing in there worth opening directly. */
export const reportCollectionPosition = 1;

/**
 * Write the whole report to Metabase: one dashboard with a tab per page. Cards first, because a
 * dashboard can only point at cards that exist, and the filter dropdowns point at cards too.
 */
export async function syncReport(api: MetabaseApi, databaseId: number, tabs: ReportTab[], collection: string, dashboardName: string, hasCoordinates = false): Promise<ReportSyncResult> {
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
                query: card.sql,
                templateTags: buildTemplateTags(card),
                visualizationSettings: buildVisualizationSettings(card, hasCoordinates),
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
    const dashboardId = existingDashboards.find(dashboard => dashboard.name === dashboardName)?.id
        ?? await api.createDashboard(dashboardName, undefined, collectionId);

    const existingTabs = new Map((await api.getDashboardTabs(dashboardId)).map(tab => [tab.name, tab.id]));
    const parameters = buildParameters(visible, filterCardIds, orderedValues);
    const dashboardTabs = buildTabs(visible, existingTabs);
    const tabIds = new Map(dashboardTabs.map(tab => [tab.name, tab.id]));

    await api.updateDashboard(dashboardId, {
        name: dashboardName,
        parameters,
        tabs: dashboardTabs,
        dashcards: buildDashcards(visible, cardIds, parameters, tabIds),
        collectionPosition: reportCollectionPosition,
    });

    await archiveSupersededDashboards(api, existingDashboards, visible, dashboardName);
    await archiveSupersededCards(api, collectionId, tabs);
    const { created: bookmarked } = await api.bookmarkDashboard(dashboardId);

    // Deduplicated: two tabs show a map under the same title, and naming it twice reads as an error.
    const mapsWithoutCoordinates = [...new Set(tabs
        .flatMap(tab => tab.cards)
        .filter(card => card.display === 'map' && !hasCoordinates)
        .map(card => card.title))];

    return { collection, collectionId, createdCollection, dashboardId, cards: cardIds.size, tabs: visible.map(tab => tab.title), bookmarked, mapsWithoutCoordinates };
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
 * dashboards named exactly after a tab are touched, so anything the client built themselves stays.
 */
async function archiveSupersededDashboards(api: MetabaseApi, existing: { id: number; name: string }[], tabs: ReportTab[], dashboardName: string): Promise<void> {
    const titles = new Set(tabs.map(tab => tab.title));

    for (const dashboard of existing.filter(dashboard => dashboard.name !== dashboardName && titles.has(dashboard.name))) {
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
