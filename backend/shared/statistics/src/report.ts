import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * The report the client's own tool produces, expressed as queries on the statistics database.
 *
 * The definitions live next to the migration that creates the tables they read, as plain `.sql`
 * files: whoever changes a column can see what it breaks, and the tests in this package run every
 * query against the real schema. Turning them into Metabase questions is the CLI's job — nothing
 * here knows that Metabase exists.
 *
 * A file holds one tab of the report and its cards, mirroring a page of the client's own report:
 *
 *     -- @tab nationaal
 *     -- title: Nationaal
 *
 *     -- @card totaal-leden
 *     -- title: Totaal leden
 *     -- display: scalar
 *     -- @include facts
 *     SELECT COUNT(DISTINCT member_id) AS `Totaal leden` FROM facts
 *
 * `@include <name>` is replaced by `includes/<name>.sql`, which is how every card counts members the
 * same way. `{{name}}` marks a query parameter, the same syntax Metabase uses, and `[[...]]` around a
 * clause drops it when that parameter is empty.
 */

export type ReportCard = {
    key: string;
    title: string;
    /** How Metabase should draw it: scalar, bar, line, pie, table, combo, gauge, row, map. */
    display: string;
    /** For a map, the columns holding the coordinates of each point. */
    latitude?: string;
    longitude?: string;
    /** Width on the dashboard: full, half, third, quarter or fifth of a row. */
    size: ReportCardSize;
    description?: string;
    /** Columns to group by, for the chart displays. */
    dimensions: string[];
    /** Columns to plot, for the chart displays. */
    metrics: string[];
    /** How bars are stacked: absent, `stacked` or `normalized`. */
    stacked?: 'stacked' | 'normalized';
    /**
     * How the labels along the x-axis are drawn. Absent lets the chart decide, which drops them
     * entirely when too many do not fit -- an eenheid or tak chart needs a rotation to keep them.
     */
    xLabels?: ReportCardXLabels;
    /** Parameters the query takes, read from the `{{...}}` in the sql. */
    parameters: string[];
    sql: string;
};

export type ReportTab = {
    key: string;
    title: string;
    description?: string;
    /**
     * The filters that drive this tab. Declared rather than taken from the cards: the shared query
     * fragments offer both filters to every card, so a tab that only wants one has to say so.
     *
     * Metabase shows filters above the whole dashboard rather than per tab, so every filter named by
     * any tab is visible everywhere; this is what decides which cards it actually reaches.
     */
    filters: string[];
    /** Cards that only feed the filter dropdowns. They live in the collection but on no tab. */
    hidden: boolean;
    cards: ReportCard[];
};

export const reportCardSizes = ['full', 'half', 'third', 'quarter', 'fifth'] as const;
export type ReportCardSize = typeof reportCardSizes[number];

export const reportCardXLabels = ['show', 'hide', 'compact', 'rotate-45', 'rotate-90'] as const;
export type ReportCardXLabels = typeof reportCardXLabels[number];

/** The tabs in the order the client's report shows its pages. */
export const reportTabOrder = ['nationaal', 'eenheden', 'netwerk', 'varia', 'filters'];

export function getReportDirectory(): string {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'report');
}

export async function loadReport(directory = getReportDirectory()): Promise<ReportTab[]> {
    const includes = await loadIncludes(path.join(directory, 'includes'));
    const files = (await fs.readdir(directory)).filter(file => file.endsWith('.sql')).sort();

    const tabs = await Promise.all(files.map(async (file) => {
        return parseTab(await fs.readFile(path.join(directory, file), 'utf-8'), file, includes);
    }));

    return tabs.sort((a, b) => orderOf(a.key) - orderOf(b.key));
}

function orderOf(key: string): number {
    const index = reportTabOrder.indexOf(key);
    return index === -1 ? reportTabOrder.length : index;
}

async function loadIncludes(directory: string): Promise<Map<string, string>> {
    const files = (await fs.readdir(directory)).filter(file => file.endsWith('.sql'));
    const includes = new Map<string, string>();

    for (const file of files) {
        includes.set(path.basename(file, '.sql'), (await fs.readFile(path.join(directory, file), 'utf-8')).trim());
    }
    return includes;
}

/**
 * Splits a file into its `@tab` header and `@card` sections. Everything that is not a directive
 * stays as it is, so a card's sql keeps the comments written above it.
 */
export function parseTab(contents: string, file: string, includes: Map<string, string>): ReportTab {
    const sections = splitSections(contents);
    const header = sections.find(section => section.kind === 'tab');

    if (!header) {
        throw new Error(`${file} has no "-- @tab <key>" header`);
    }

    const cards = sections.filter(section => section.kind === 'card').map(section => parseCard(section, file, includes));
    if (cards.length === 0) {
        throw new Error(`${file} declares no cards`);
    }

    const filters = splitList(header.attributes.get('filters'));
    const offered = new Set(cards.flatMap(card => card.parameters));
    const unused = filters.filter(filter => !offered.has(filter));
    if (unused.length > 0) {
        throw new Error(`${file}: filter "${unused[0]}" is declared but no card uses {{${unused[0]}}}`);
    }

    return {
        key: header.key,
        title: required(header.attributes, 'title', file, header.key),
        description: header.attributes.get('description'),
        filters,
        hidden: header.attributes.get('hidden') === 'true',
        cards,
    };
}

type Section = { kind: 'tab' | 'card'; key: string; attributes: Map<string, string>; body: string };

function splitSections(contents: string): Section[] {
    const sections: Section[] = [];
    let current: Section | undefined;

    for (const line of contents.split('\n')) {
        const directive = /^--[ \t]*@(tab|card)[ \t]+(\S+)[ \t]*$/.exec(line);
        if (directive) {
            current = { kind: directive[1] as 'tab' | 'card', key: directive[2], attributes: new Map(), body: '' };
            sections.push(current);
            continue;
        }
        if (!current) {
            continue;
        }

        // An attribute only counts while the body has not started; further comments belong to the sql.
        // The value keeps its leading spaces here and is trimmed below: matching them separately
        // would let the two quantifiers split the same run of spaces in several ways.
        const attribute = /^--[ \t]*([a-z]+):(.*)$/.exec(line);
        if (attribute && current.body.trim().length === 0) {
            current.attributes.set(attribute[1], attribute[2].trim());
            continue;
        }
        current.body += line + '\n';
    }

    return sections;
}

function parseCard(section: Section, file: string, includes: Map<string, string>): ReportCard {
    const size = section.attributes.get('size') ?? 'half';
    if (!(reportCardSizes as readonly string[]).includes(size)) {
        throw new Error(`${file}: card "${section.key}" has size "${size}", expected one of ${reportCardSizes.join(', ')}`);
    }

    const stacked = section.attributes.get('stacked');
    if (stacked !== undefined && stacked !== 'stacked' && stacked !== 'normalized') {
        throw new Error(`${file}: card "${section.key}" has stacked "${stacked}", expected stacked or normalized`);
    }

    const xLabels = section.attributes.get('xlabels');
    if (xLabels !== undefined && !(reportCardXLabels as readonly string[]).includes(xLabels)) {
        throw new Error(`${file}: card "${section.key}" has xlabels "${xLabels}", expected one of ${reportCardXLabels.join(', ')}`);
    }

    const display = required(section.attributes, 'display', file, section.key);
    const latitude = section.attributes.get('latitude');
    const longitude = section.attributes.get('longitude');
    if (display === 'map' && (latitude === undefined || longitude === undefined)) {
        throw new Error(`${file}: card "${section.key}" is a map but names no latitude and longitude columns`);
    }

    const sql = expandIncludes(section.body, includes, file, section.key).trim();

    return {
        key: section.key,
        title: required(section.attributes, 'title', file, section.key),
        display,
        latitude,
        longitude,
        size: size as ReportCardSize,
        description: section.attributes.get('description'),
        dimensions: splitList(section.attributes.get('dimensions')),
        metrics: splitList(section.attributes.get('metrics')),
        stacked,
        xLabels: xLabels as ReportCardXLabels | undefined,
        parameters: parameterNames(sql),
        sql,
    };
}

function expandIncludes(body: string, includes: Map<string, string>, file: string, card: string): string {
    return body.replaceAll(/^([ \t]*)--[ \t]*@include[ \t]+(\S+)[ \t]*$/gm, (_match, indent: string, name: string) => {
        const include = includes.get(name);
        if (include === undefined) {
            throw new Error(`${file}: card "${card}" includes "${name}", which has no report/includes/${name}.sql`);
        }
        return include.split('\n').map(line => indent + line).join('\n');
    });
}

/** The `{{name}}` parameters a query uses, in the order they first appear. */
export function parameterNames(sql: string): string[] {
    return [...new Set([...sql.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map(match => match[1]))];
}

function splitList(value: string | undefined): string[] {
    return value === undefined ? [] : value.split(',').map(entry => entry.trim()).filter(entry => entry.length > 0);
}

function required(attributes: Map<string, string>, name: string, file: string, key: string): string {
    const value = attributes.get(name);
    if (value === undefined || value.length === 0) {
        throw new Error(`${file}: "${key}" has no ${name}`);
    }
    return value;
}

/**
 * The sql as it runs outside Metabase: parameters resolved and the `[[...]]` clauses around them
 * kept or dropped. Used by the tests to run a card against a real database, since Metabase is the
 * only thing that understands this syntax.
 */
export function resolveSql(sql: string, values: Record<string, string | null> = {}): string {
    const optional = sql.replaceAll(/\[\[([\s\S]*?)\]\]/g, (_match, clause: string) => {
        return parameterNames(clause).every(name => values[name] !== undefined && values[name] !== null) ? clause : '';
    });

    return optional.replaceAll(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, name: string) => {
        const value = values[name];
        return value === undefined || value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`;
    });
}
