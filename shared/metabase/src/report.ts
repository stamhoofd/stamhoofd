import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * The report the client's own tool produces, expressed as queries on the statistics database.
 *
 * The definitions are plain `.sql` files, read and checked for shape without ever being run: the
 * schema they query belongs to the statistics syncer, which this package does not depend on. Turning
 * them into Metabase questions is `sync-report.ts` — nothing here knows Metabase exists.
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
 * same way, and a fragment may include another. `{{name}}` marks a query parameter, the same syntax
 * Metabase uses, and `[[...]]` around a clause drops it when that parameter is empty. A parameter
 * several values can be chosen for is written `IN ({{name}})`, since Metabase replaces it with all of
 * them, comma separated.
 *
 * The same report is written for every platform, which do not all count the same thing the same way.
 * Where they differ, the environment says which variant a card gets: `includes/<env>/<name>.sql`
 * replaces the fragment of that name, and a setting written `-- description@<env>:` replaces the
 * unqualified one. Neither is visible to a card, which keeps saying `@include gtp`.
 */

export type ReportCard = {
    key: string;
    title: string;
    /** How Metabase should draw it: scalar, bar, line, pie, table, combo, gauge, row, map. */
    display: string;
    /** For a map, the columns holding the coordinates of each point. */
    latitude?: string;
    longitude?: string;
    /** Width on the dashboard: full, two-thirds, half, third, quarter or sixth of a row. */
    size: ReportCardSize;
    /**
     * How tall the card is drawn, in rows of the dashboard grid -- the unit the layout counts in.
     * Absent takes the height its display asks for, which is what nearly every card does; a chart
     * that has to be read closely says its own.
     */
    height?: number;
    /**
     * How many rows of cards this one stands across. `1` unless it says otherwise: a card spanning
     * two stands beside the two cards stacked next to it and is as tall as both of those rows
     * together, which is how the netwerk map keeps the height of the chart and the pie beside it.
     */
    span: number;
    description?: string;
    /** Columns to group by, for the chart displays. */
    dimensions: string[];
    /** Columns to plot, for the chart displays. */
    metrics: string[];
    /**
     * The headers a table has to be exported under, in order. Named here because a card that is
     * downloaded rather than read on screen has an agreed structure to keep: Metabase writes the
     * header of an export from the column's title, and a title it was not given is whatever it makes
     * of the alias.
     */
    columns: string[];
    /** How bars are stacked: absent, `stacked` or `normalized`. */
    stacked?: 'stacked' | 'normalized';
    /**
     * The boundaries the figure is read in, lowest first: `0, 35, 55, 75, 95, 115, 135` makes six
     * ranges. A gauge draws them as its arc and a number is colored by the one it falls in, which is
     * how the two cards of one figure say the same thing. The outer two are where the arc starts and
     * stops rather than a figure anything is measured against, since the figure itself has no ends.
     * Absent leaves a gauge to Metabase, which splits the arc in three, and a number uncolored.
     */
    segments: number[];
    /**
     * Which end of those ranges is the good one, and therefore which of them is green: `high` unless
     * the card says otherwise. The omkaderingscijfer is the one that reads the other way round --
     * the fewer leden a leider has to look after, the better.
     */
    best: ReportCardBest;
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
     * The dashboard this tab belongs to. Absent puts it on the report's own dashboard, beside the
     * pages it mirrors. A tab that is not part of the client's report names one of its own, which is
     * written as a separate dashboard in the same collection.
     */
    dashboard?: string;
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

export const reportCardSizes = ['full', 'two-thirds', 'half', 'third', 'quarter', 'sixth'] as const;
export type ReportCardSize = typeof reportCardSizes[number];

export const reportCardXLabels = ['show', 'hide', 'compact', 'rotate-45', 'rotate-90'] as const;
export type ReportCardXLabels = typeof reportCardXLabels[number];

export const reportCardBest = ['low', 'high'] as const;
export type ReportCardBest = typeof reportCardBest[number];

/** The order the tabs are written in: the pages of the client's report first, then what is not one. */
export const reportTabOrder = ['nationaal', 'eenheden', 'netwerk', 'varia', 'jeugdbewegingen', 'filters'];

export function getReportDirectory(): string {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'report');
}

/**
 * The report as one environment counts it.
 *
 * Not every figure is counted the same everywhere -- the GTP index weighs takken for keeo and ages
 * for ravot -- and a statistics database holds one platform, so which variant a card gets is decided
 * here rather than in the queries. `env` is the same name the data source carries.
 */
export async function loadReport(env: string, directory = getReportDirectory()): Promise<ReportTab[]> {
    const includes = await loadIncludes(path.join(directory, 'includes'), env);
    const files = (await fs.readdir(directory)).filter(file => file.endsWith('.sql')).sort();

    const tabs = await Promise.all(files.map(async (file) => {
        return parseTab(await fs.readFile(path.join(directory, file), 'utf-8'), file, includes, env);
    }));

    return tabs.sort((a, b) => orderOf(a.key) - orderOf(b.key));
}

function orderOf(key: string): number {
    const index = reportTabOrder.indexOf(key);
    return index === -1 ? reportTabOrder.length : index;
}

/**
 * The shared fragments, with the ones this environment counts differently laid over them:
 * `includes/<env>/gtp.sql` is what `@include gtp` expands to there, while every other environment
 * keeps `includes/gtp.sql`. A card therefore never says which platform it is written for.
 *
 * An override of a name no fragment carries is a mistake rather than a fragment only one environment
 * has: nothing includes it, so a misspelled file would change nothing and say nothing.
 */
async function loadIncludes(directory: string, env: string): Promise<Map<string, string>> {
    const includes = await readIncludes(directory);

    for (const [name, sql] of await readIncludes(path.join(directory, env))) {
        if (!includes.has(name)) {
            throw new Error(`includes/${env}/${name}.sql overrides "${name}", which has no includes/${name}.sql`);
        }
        includes.set(name, sql);
    }

    return includes;
}

/** The `.sql` files of a directory by name. An environment that overrides nothing has no directory. */
async function readIncludes(directory: string): Promise<Map<string, string>> {
    let entries: string[];
    try {
        entries = await fs.readdir(directory);
    }
    catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') {
            return new Map();
        }
        throw error;
    }

    const includes = new Map<string, string>();
    for (const file of entries.filter(entry => entry.endsWith('.sql'))) {
        includes.set(path.basename(file, '.sql'), (await fs.readFile(path.join(directory, file), 'utf-8')).trim());
    }
    return includes;
}

/**
 * Splits a file into its `@tab` header and `@card` sections. Everything that is not a directive
 * stays as it is, so a card's sql keeps the comments written above it.
 */
export function parseTab(contents: string, file: string, includes: Map<string, string>, env?: string): ReportTab {
    const sections = splitSections(contents, file, env);
    const header = sections.find(section => section.kind === 'tab');

    if (!header) {
        throw new Error(`${file} has no "-- @tab <key>" header`);
    }

    const cards = sections.filter(section => section.kind === 'card').map(section => parseCard(section, file, includes));
    if (cards.length === 0) {
        throw new Error(`${file} declares no cards`);
    }

    // A question is stored under its title, so two cards sharing one on the same tab would end up as
    // the same question: whichever is written last decides what both show.
    const duplicate = cards.find((card, index) => cards.findIndex(other => other.title === card.title) !== index);
    if (duplicate) {
        throw new Error(`${file}: two cards are titled "${duplicate.title}", which would store them as one question`);
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
        dashboard: header.attributes.get('dashboard'),
        filters,
        hidden: header.attributes.get('hidden') === 'true',
        cards,
    };
}

type Section = { kind: 'tab' | 'card'; key: string; attributes: Map<string, string>; qualified: Set<string>; body: string };

/**
 * Every setting a tab or card understands. A line shaped like one below the query is a setting that
 * slipped down rather than a comment, and would otherwise be dropped without a word: writing a
 * comment above `-- size:` is enough to make the whole block below it stop counting.
 */
const knownAttributes = new Set(['title', 'display', 'size', 'description', 'dimensions', 'metrics', 'columns', 'stacked', 'segments', 'best', 'xlabels', 'height', 'span', 'latitude', 'longitude', 'filters', 'hidden', 'dashboard']);

function splitSections(contents: string, file: string, env?: string): Section[] {
    const sections: Section[] = [];
    let current: Section | undefined;

    for (const line of contents.split('\n')) {
        const directive = /^--[ \t]*@(tab|card)[ \t]+(\S+)[ \t]*$/.exec(line);
        if (directive) {
            current = { kind: directive[1] as 'tab' | 'card', key: directive[2], attributes: new Map(), qualified: new Set(), body: '' };
            sections.push(current);
            continue;
        }
        if (!current) {
            continue;
        }

        // An attribute only counts while the body has not started; further comments belong to the sql.
        // The value keeps its leading spaces here and is trimmed below: matching them separately
        // would let the two quantifiers split the same run of spaces in several ways.
        const attribute = /^--[ \t]*([a-z]+)(?:@([a-z0-9-]+))?:(.*)$/.exec(line);
        if (attribute) {
            if (current.body.trim().length === 0) {
                setAttribute(current, attribute[1], attribute[2], attribute[3].trim(), env);
                continue;
            }
            if (knownAttributes.has(attribute[1])) {
                throw new Error(`${file}: "${current.key}" has "${attribute[1]}:" below the query, where it is read as a comment instead of a setting. Move it above the first comment and @include.`);
            }
        }
        current.body += line + '\n';
    }

    return sections;
}

/**
 * A setting written `-- description@ravot:` only holds in that environment, and beats the unqualified
 * one wherever it does, whichever of the two is written first. It is how a card says a figure that is
 * not counted the same everywhere in the words of the platform reading it, without becoming two cards.
 */
function setAttribute(section: Section, name: string, qualifier: string | undefined, value: string, env: string | undefined): void {
    if (qualifier === undefined) {
        if (!section.qualified.has(name)) {
            section.attributes.set(name, value);
        }
        return;
    }
    if (qualifier !== env) {
        return;
    }

    section.qualified.add(name);
    section.attributes.set(name, value);
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

    const { segments, best } = parseRanges(section, file, display);
    const height = parseCount(section, file, 'height');
    const span = parseCount(section, file, 'span') ?? 1;

    // A spanning card is as tall as the rows it stands across, so a height of its own would be read
    // by neither: the layout hands it the one it computes.
    if (height !== undefined && span > 1) {
        throw new Error(`${file}: card "${section.key}" spans ${span} rows and names a height, which the rows it spans decide`);
    }

    const sql = expandIncludes(section.body, includes, file, section.key).trim();

    return {
        key: section.key,
        title: required(section.attributes, 'title', file, section.key),
        display,
        latitude,
        longitude,
        size: size as ReportCardSize,
        height,
        span,
        description: section.attributes.get('description'),
        dimensions: splitList(section.attributes.get('dimensions')),
        metrics: splitList(section.attributes.get('metrics')),
        columns: splitList(section.attributes.get('columns')),
        stacked,
        segments,
        best,
        xLabels: xLabels as ReportCardXLabels | undefined,
        parameters: parameterNames(sql),
        sql,
    };
}

/** A setting counted in whole cards or rows, which is only a size while it is a positive number. */
function parseCount(section: Section, file: string, name: string): number | undefined {
    const written = section.attributes.get(name);
    if (written === undefined) {
        return undefined;
    }

    const count = Number(written);
    if (!Number.isInteger(count) || count < 1) {
        throw new Error(`${file}: card "${section.key}" has ${name} "${written}", expected a whole number of rows`);
    }
    return count;
}

/** The displays that read a figure against ranges: a gauge draws them, a number is colored by them. */
const rangedDisplays = ['gauge', 'scalar'];

/**
 * How a figure is divided into ranges and which way they are read, both of which every other display
 * would silently drop. The boundaries rise, because a range that ends before it starts is drawn
 * nowhere on the arc, and there are at least three of them so the ranges say something the figure
 * does not say on its own.
 */
function parseRanges(section: Section, file: string, display: string): { segments: number[]; best: ReportCardBest } {
    const written = section.attributes.get('segments');
    const best = section.attributes.get('best') ?? 'high';

    for (const name of ['segments', 'best']) {
        if (section.attributes.has(name) && !rangedDisplays.includes(display)) {
            throw new Error(`${file}: card "${section.key}" names ${name}, which only a gauge or a number reads`);
        }
    }
    if (!(reportCardBest as readonly string[]).includes(best)) {
        throw new Error(`${file}: card "${section.key}" has best "${best}", expected one of ${reportCardBest.join(', ')}`);
    }
    // Which end is the good one only decides how the ranges are colored, so on its own it colors
    // nothing: a number without ranges keeps its own color, and the ones a gauge falls back to are
    // drawn in Metabase's.
    if (section.attributes.has('best') && written === undefined) {
        throw new Error(`${file}: card "${section.key}" says its best is "${best}" but names no segments to color`);
    }
    if (written === undefined) {
        return { segments: [], best: best as ReportCardBest };
    }

    const segments = splitList(written).map(entry => Number(entry));
    if (segments.length < 3) {
        throw new Error(`${file}: card "${section.key}" has segments "${written}", expected at least three boundaries`);
    }
    if (segments.some((boundary, index) => !Number.isFinite(boundary) || (index > 0 && boundary <= segments[index - 1]))) {
        throw new Error(`${file}: card "${section.key}" has segments "${written}", expected rising numbers`);
    }

    return { segments, best: best as ReportCardBest };
}

/** A fragment may include another, which is how the two grains of `facts` share their filters. */
function expandIncludes(body: string, includes: Map<string, string>, file: string, card: string, chain: string[] = []): string {
    return body.replaceAll(/^([ \t]*)--[ \t]*@include[ \t]+(\S+)[ \t]*$/gm, (_match, indent: string, name: string) => {
        const include = includes.get(name);
        if (include === undefined) {
            throw new Error(`${file}: card "${card}" includes "${name}", which has no report/includes/${name}.sql`);
        }
        if (chain.includes(name)) {
            throw new Error(`${file}: card "${card}" includes "${name}" from within itself: ${[...chain, name].join(' -> ')}`);
        }

        return expandIncludes(include, includes, file, card, [...chain, name])
            .split('\n').map(line => indent + line).join('\n');
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
