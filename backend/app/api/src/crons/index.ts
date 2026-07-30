/**
 * Crons register themselves with one of three helpers, depending on whose work they do:
 *
 * - registerTenantCron — work belonging to one tenant (its organizations, members, emails, balances)
 * - registerFeesTenantCron — charging the tenants that name this one as their fees tenant
 * - registerCron — genuinely global: not attributable to a tenant
 *
 * The global ones are amazon-ses (bounces, complaints and replies arrive for every tenant at once),
 * clearExcelCache, mollie-refunds and mollie-chargebacks.
 */
import './amazon-ses.js';
import './clearExcelCache.js';
import './endFunctionsOfUsersWithoutRegistration.js';
import './update-cached-balances.js';
import './cleanup-orphaned-cached-balances.js';
import './balance-emails.js';
import './delete-old-email-drafts.js';
import './delete-expired-mfa-tokens.js';
import './delete-archived-data.js';
import './mollie-chargebacks.js';
import './mollie-refunds.js';
import './invoices.js';
import './service-fees.js';
import './members-fees.js';
import './stripe-invoices.js';
import './stripe-payout-reports.js';
import './transfer-fees.js';
import './drip-emails.js';
import './update-organization-future-events.js';
