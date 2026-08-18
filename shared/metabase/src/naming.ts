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

/**
 * The collection the ledenstatistieken dashboards of an environment live in.
 *
 * Scoped per environment for the same reason the data source is: one Metabase serves them all, and a
 * question can only read from one database. A shared collection would mean the last environment
 * pushed silently repoints every dashboard of the others.
 */
export function metabaseReportCollectionName(env: string): string {
    return `Ledenstatistieken (${env})`;
}

/**
 * The dashboard a tab lands on unless it names one of its own: one tab per page of the client's own
 * report.
 */
export const metabaseReportDashboardName = 'Ledenstatistieken';

/**
 * Tables of the statistics database that are infrastructure rather than data. They are hidden in
 * Metabase so they stay out of the query builder and the data reference.
 */
export const metabaseHiddenTables = ['migrations'];
