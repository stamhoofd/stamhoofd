import { registerCron } from '@stamhoofd/crons';
import { ROOT_TENANT_ID } from '@stamhoofd/models';

import { TenantContext } from '../../helpers/TenantContext.js';

/**
 * Runs a cron in the tenant scope it belongs to.
 *
 * ⚠️ It does **not** fan out over tenants yet, and it must not start doing so before the crons using
 * it keep their throttling per tenant. Most of them hold module level state (`lastRunDate`,
 * `lastFullRun`, a saved iterator) to run once a day or to resume a cursor. Called once per tenant in
 * a loop, the first tenant would set that state and every other tenant would be skipped for the rest
 * of the day — or worse, share the cursor.
 */
export function withTenantScope(method: () => Promise<void>): () => Promise<void> {
    return async () => {
        await TenantContext.run(ROOT_TENANT_ID, method);
    };
}

/**
 * A cron that does work belonging to one tenant: its organizations, members, emails or balances.
 */
export function registerTenantCron(name: string, method: () => Promise<void>) {
    registerCron(name, withTenantScope(method));
}

/**
 * A cron that charges the tenants naming this one as their fees tenant: packages, transfer fees,
 * service fees, invoices and payout reports.
 *
 * Distinct from registerTenantCron because it will fan out over a different set: the tenants that
 * point at this one, rather than this one's own organizations. Today both are the root tenant.
 */
export function registerFeesTenantCron(name: string, method: () => Promise<void>) {
    registerCron(name, withTenantScope(method));
}
