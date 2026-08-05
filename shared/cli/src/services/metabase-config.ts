import type { DevelopmentDomains } from '../config/development-config.js';
import { dockerHostGateway, mysqlRootPassword, mysqlRootUser } from '../config/shared-service-config.js';

export type MetabaseDataSource = {
    database: string;
    mysqlPort: number;
};

/**
 * The connection details to fill in when adding the development database as a data source in
 * Metabase. The host is the Docker host gateway, not 127.0.0.1: Metabase dials it from inside its
 * own container, where localhost is the container itself.
 */
export function buildMetabaseConfigOutput(domains: DevelopmentDomains, dataSource: MetabaseDataSource): string {
    return `Local Metabase:

  URL:           https://${domains.metabase}

The first visit opens the Metabase setup wizard, where you create the admin account.
Skip the "Add your data" step there, then add the development database under
Settings > Admin settings > Databases > Add database:

  Database type: MySQL
  Host:          ${dockerHostGateway}
  Port:          ${dataSource.mysqlPort}
  Database name: ${dataSource.database}
  Username:      ${mysqlRootUser}
  Password:      ${mysqlRootPassword}

Commands:

  stam metabase logs
  stam metabase stop`;
}
