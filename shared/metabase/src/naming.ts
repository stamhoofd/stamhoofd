/**
 * What the report is called inside Metabase. Shared by every caller so a dashboard written locally
 * and one written to a server end up under the same names, and running either again updates in
 * place instead of adding a second copy.
 */

/**
 * The name a platform statistics database is registered under in Metabase. One Metabase can serve
 * several environments, so the environment has to be visible in the name.
 */
export function metabaseDataSourceName(env: string): string {
    return `Platform statistics (${env})`;
}

const reportName = 'Ledenstatistieken';

/**
 * The collection the ledenstatistieken dashboards live in.
 *
 * One collection, whichever platform it counts. A local Metabase holds several environments' data
 * sources but shows one report: writing the report of an environment points the questions in here at
 * its data source, so the collection always holds the platform that was written last. A server holds
 * one platform and never sees the difference.
 */
export const metabaseReportCollectionName = 'Statistieken';

/**
 * The dashboard a tab lands on unless it names one of its own: one tab per page of the client's own
 * report.
 */
export const metabaseReportDashboardName = reportName;

const legacyReportCollectionPattern = new RegExp(`^${reportName} \\([^()]+\\)$`);

/**
 * Whether a name is the one the collection carried while there was one per environment
 * (`Ledenstatistieken (keeo)`). Recognised so that collection can be renamed into the one written
 * now instead of being left beside it.
 */
export function isLegacyReportCollectionName(name: string): boolean {
    return legacyReportCollectionPattern.test(name);
}

/**
 * Tables of the statistics database that are infrastructure rather than data. They are hidden in
 * Metabase so they stay out of the query builder and the data reference.
 */
export const metabaseHiddenTables = ['migrations'];
