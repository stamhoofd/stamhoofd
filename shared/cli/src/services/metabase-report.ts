import type { MetabaseApi } from './metabase-api.js';

/**
 * Turns the report definition of `@stamhoofd/statistics` into Metabase questions and dashboards.
 *
 * The queries themselves live with the schema they read, in `backend/shared/statistics/report`. This
 * file only knows how to say them in Metabase's vocabulary: which display, which columns on which
 * axis, and which filter drives which card.
 *
 * Everything here is written by name and updated in place, so running it twice changes nothing and
 * running it after an edit only moves what actually changed.
 */

export type ReportCard = {
    key: string;
    title: string;
    display: string;
    size: 'full' | 'half' | 'third' | 'quarter' | 'fifth';
    description?: string;
    dimensions: string[];
    metrics: string[];
    stacked?: 'stacked' | 'normalized';
    parameters: string[];
    sql: string;
};

export type ReportDashboard = {
    key: string;
    title: string;
    description?: string;
    /** The filters shown above this dashboard, by name. */
    filters: string[];
    hidden: boolean;
    cards: ReportCard[];
};

/** The collection every dashboard and question of the report is written to. */
export const reportCollectionName = 'Ledenstatistieken';

/**
 * The filters shown above the dashboards. `valuesFrom` names the card in the hidden `filters`
 * dashboard that fills the dropdown, and `column` the column to read the values from.
 */
export const reportFilters = [
    { name: 'scoutsjaar', title: 'Scoutsjaar', valuesFrom: 'scoutsjaar', column: 'Scoutsjaar' },
    { name: 'eenheid', title: 'Eenheid', valuesFrom: 'eenheid', column: 'Eenheid' },
] as const;

/** Metabase lays a dashboard out on a 24 column grid. */
const gridWidth = 24;

const widths: Record<ReportCard['size'], number> = { full: 24, half: 12, third: 8, quarter: 6, fifth: 4 };

function heightOf(card: ReportCard): number {
    if (card.display === 'scalar' || card.display === 'gauge') {
        return 3;
    }
    if (card.display === 'table') {
        return 8;
    }
    return card.size === 'full' ? 7 : 6;
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

export function buildVisualizationSettings(card: ReportCard): Record<string, unknown> {
    const settings: Record<string, unknown> = { 'card.title': card.title };

    if (card.description !== undefined) {
        settings['card.description'] = card.description;
    }

    if (card.display === 'pie') {
        settings['pie.dimension'] = card.dimensions[0];
        settings['pie.metric'] = card.metrics[0];
        return settings;
    }

    if (['bar', 'line', 'combo', 'area', 'row'].includes(card.display)) {
        settings['graph.dimensions'] = card.dimensions;
        settings['graph.metrics'] = card.metrics;

        if (card.stacked !== undefined) {
            settings['stackable.stack_type'] = card.stacked === 'normalized' ? 'normalized' : 'stacked';
        }
        // A combo chart draws its first series as bars and the rest as a line, which is what the
        // "aantal leden + GTP index" chart of the report needs.
        if (card.display === 'combo') {
            settings['graph.series_settings'] = Object.fromEntries(card.metrics.map((metric, index) => [metric, { display: index === 0 ? 'bar' : 'line' }]));
        }
    }

    return settings;
}

/**
 * The dashboard filters, pointed at the cards that fill their dropdowns. Only the ones the dashboard
 * declares: the shared query fragments offer both filters to every card, so going by what the cards
 * accept would give the national page a unit filter the report does not have.
 */
export function buildParameters(dashboard: ReportDashboard, filterCardIds: Map<string, number>): Record<string, unknown>[] {
    return reportFilters
        .filter(filter => dashboard.filters.includes(filter.name))
        .map((filter) => {
            const cardId = filterCardIds.get(filter.valuesFrom);

            return {
                id: templateTagId('dashboard', filter.name).slice(0, 8),
                name: filter.title,
                slug: filter.name,
                type: 'string/=',
                sectionId: 'string',
                ...(cardId === undefined
                    ? {}
                    : {
                            values_source_type: 'card',
                            values_source_config: {
                                card_id: cardId,
                                value_field: ['field', filter.column, { 'base-type': 'type/Text' }],
                            },
                        }),
            };
        });
}

export function buildDashcards(dashboard: ReportDashboard, cardIds: Map<string, number>, parameters: Record<string, unknown>[]): Record<string, unknown>[] {
    return layoutCards(dashboard.cards).map((placed, index) => {
        const cardId = cardIds.get(placed.card.key)!;

        return {
            // Metabase reads a negative id as "this one is new".
            id: -1 - index,
            card_id: cardId,
            row: placed.row,
            col: placed.col,
            size_x: placed.sizeX,
            size_y: placed.sizeY,
            visualization_settings: {},
            parameter_mappings: parameters
                .filter(parameter => placed.card.parameters.includes(parameter.slug as string))
                .map(parameter => ({
                    parameter_id: parameter.id,
                    card_id: cardId,
                    target: ['variable', ['template-tag', parameter.slug]],
                })),
        };
    });
}

export type ReportSyncResult = {
    collectionId: number;
    createdCollection: boolean;
    cards: number;
    dashboards: string[];
};

/**
 * Write the whole report to Metabase. Cards first, because a dashboard can only point at cards that
 * exist, and the filter dropdowns point at cards too.
 */
export async function syncReport(api: MetabaseApi, databaseId: number, dashboards: ReportDashboard[]): Promise<ReportSyncResult> {
    const { id: collectionId, created: createdCollection } = await api.ensureCollection(reportCollectionName);

    const existingCards = new Map((await api.listCards(collectionId)).map(card => [card.name, card.id]));
    const cardIds = new Map<string, number>();
    const filterCardIds = new Map<string, number>();

    for (const dashboard of dashboards) {
        for (const card of dashboard.cards) {
            const id = await api.saveCard({
                name: card.title,
                description: card.description,
                display: card.display,
                databaseId,
                query: card.sql,
                templateTags: buildTemplateTags(card),
                visualizationSettings: buildVisualizationSettings(card),
                collectionId,
            }, existingCards.get(card.title));

            cardIds.set(card.key, id);
            if (dashboard.key === 'filters') {
                filterCardIds.set(card.key, id);
            }
        }
    }

    const existingDashboards = new Map((await api.listDashboards(collectionId)).map(dashboard => [dashboard.name, dashboard.id]));
    const written: string[] = [];

    for (const dashboard of dashboards.filter(dashboard => !dashboard.hidden)) {
        const id = existingDashboards.get(dashboard.title) ?? await api.createDashboard(dashboard.title, dashboard.description, collectionId);
        const parameters = buildParameters(dashboard, filterCardIds);

        await api.updateDashboard(id, {
            name: dashboard.title,
            description: dashboard.description,
            parameters,
            dashcards: buildDashcards(dashboard, cardIds, parameters),
        });
        written.push(dashboard.title);
    }

    return { collectionId, createdCollection, cards: cardIds.size, dashboards: written };
}
