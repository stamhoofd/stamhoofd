import type { DevelopmentDomains } from '../config/development-config.js';
import { dockerHostGateway, mysqlRootPassword, mysqlRootUser } from '../config/shared-service-config.js';
import type { MetabaseAdmin } from './metabase-api.js';

/**
 * The admin account the CLI creates when it completes the setup wizard, so it can keep configuring
 * the instance later. Override both when the instance was set up by hand with another account:
 * without valid credentials the CLI cannot register the platform statistics database.
 */
export const metabaseAdminEmail = process.env.METABASE_ADMIN_EMAIL ?? 'dev@stamhoofd.local';
export const metabaseAdminPassword = process.env.METABASE_ADMIN_PASSWORD ?? 'stamhoofd-local-1';

export const metabaseAdmin: MetabaseAdmin = {
    email: metabaseAdminEmail,
    password: metabaseAdminPassword,
    firstName: 'Stamhoofd',
    lastName: 'Development',
};

export type MetabaseDataSource = {
    name: string;
    database: string;
    mysqlPort: number;
};

/**
 * The name a platform statistics database is registered under in Metabase. One Metabase serves every
 * environment, so the environment has to be visible in the name.
 */
export function metabaseDataSourceName(env: string): string {
    return `Platform statistics (${env})`;
}

/**
 * Tables of the statistics database that are infrastructure rather than data. They are hidden in
 * Metabase so they stay out of the query builder and the data reference.
 */
export const metabaseHiddenTables = ['migrations'];

export function buildMetabaseConfigOutput(domains: DevelopmentDomains, dataSource: MetabaseDataSource): string {
    return `Local Metabase:

  URL:           https://${domains.metabase}
  Email:         ${metabaseAdminEmail}
  Password:      ${metabaseAdminPassword}

Platform statistics database, registered automatically:

  Name:          ${dataSource.name}
  Database type: MySQL
  Host:          ${dockerHostGateway}
  Port:          ${dataSource.mysqlPort}
  Database name: ${dataSource.database}
  Username:      ${mysqlRootUser}
  Password:      ${mysqlRootPassword}

Commands:

  stam metabase start --env keeo
  stam metabase report
  stam metabase logs
  stam metabase stop`;
}
