import { MolliePayment, MollieToken, Order, Organization, PayconiqPayment, Payment, StripeAccount } from '@stamhoofd/models';
import type { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { PaymentProvider, SettlementReference } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import axios from 'axios';
import { createHash } from 'crypto';

import { ReportedRows, SettlementService } from '../services/SettlementService.js';
import { StripePayoutChecker } from './StripePayoutChecker.js';

type MollieSettlementCost = {
    description: string;
    method: string | null;
    amountNet: {
        currency: string;
        value: string;
    };
    amountVat: {
        currency: string;
        value: string;
    } | null;
};

type MollieSettlement = {
    id: string;
    reference: string;
    createdAt: string;
    settledAt: string;
    status: 'open' | 'pending' | 'paidout' | 'failed';
    amount: {
        currenty: string;
        value: string;
    };
    /**
     * "The ID of the oldest invoice created for all the periods": null until Mollie created it,
     * filled in by the regular re-walk of recent settlements.
     */
    invoiceId?: string | null;
    periods?: Record<string, Record<string, { costs?: MollieSettlementCost[]; invoiceId?: string | null }>>;
};

/**
 * Everything the new-rows dual-write of one settlement walk needs to share between the resource
 * pages.
 */
type SettlementSyncState = {
    settlementRow: Settlement;
    reported: ReportedRows;
};

/**
 * Same expression as the legacy blob write, so the two can never disagree (euros → 4-decimal
 * platform units).
 */
function mollieAmountToUnits(value: string): number {
    return Math.round(parseFloat(value) * 100) * 100;
}

function getMollieSettlementStatus(status: MollieSettlement['status']): SettlementStatus {
    switch (status) {
        case 'paidout': return SettlementStatus.Paid;
        case 'failed': return SettlementStatus.Failed;
        default: return SettlementStatus.Pending;
    }
}

/**
 * Both payments (tr_...) and refunds (re_...) settled in a settlement are matched to a local
 * payment through the mollieId of their MolliePayment link, so we only need their id here.
 */
type MollieSettlementEntryJSON = {
    id: string;
};

let lastSettlementCheck: Date | null = null;

export async function checkAllStripePayouts(checkAll = false) {
    if (STAMHOOFD.environment !== 'production' || !STAMHOOFD.STRIPE_SECRET_KEY) {
        console.log('Skip settlement check');
        return;
    }

    // Stripe payouts
    const stripeAccounts = await StripeAccount.where({ status: 'active' });
    for (const account of stripeAccounts) {
        try {
            console.log('Checking settlements for ', account.accountId);

            const checker = new StripePayoutChecker({
                secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
                stripeAccount: account.accountId,
            });
            await checker.checkSettlements(checkAll);
        } catch (e) {
            console.error(e);
        }
    }
}

export async function checkSettlements(checkAll = false) {
    if (STAMHOOFD.environment !== 'production') {
        return;
    }

    if (!checkAll && lastSettlementCheck && (lastSettlementCheck > new Date(new Date().getTime() - 24 * 60 * 60 * 1000))) {
        console.log('Skip settlement check');
        return;
    }

    console.log('Checking settlements...');
    lastSettlementCheck = new Date();

    // Mollie payment is required
    const token = STAMHOOFD.MOLLIE_ORGANIZATION_TOKEN;
    if (!token) {
        console.error('Missing mollie organization token');
    } else {
        try {
            // The platform's own Mollie account belongs to the membership organization
            await checkMollieSettlementsFor(token, await SettlementService.getPlatformOrganizationId(), checkAll);
        } catch (e) {
            console.error(e);
        }
    }

    // Loop all mollie tokens created after given date (when settlement permission was added)
    try {
        // Stripe payouts
        await checkAllStripePayouts(checkAll);

        const mollieTokens = await MollieToken.all();
        for (const token of mollieTokens) {
            if (token.createdAt < new Date(2021, 8 /* september! */, 8)) {
                console.log('Skipped mollie token that is too old');
            } else {
                try {
                    await token.refreshIfNeeded();
                    await checkMollieSettlementsFor(token.accessToken, token.organizationId, checkAll);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

/**
 * Walk the settlements of one Mollie account. `organizationId` is the organization that owns the
 * account the token belongs to: every settlement row it writes is theirs.
 */
export async function checkMollieSettlementsFor(token: string, organizationId: string, checkAll = false) {
    // Check last 2 weeks + 3 day margin, unless we check them all
    const d = new Date();
    d.setDate(d.getDate() - 17);

    console.log('Checking settlements for given token...');

    // Loop all organizations with online paymetns the last week
    try {
        const request = await axios.get('https://api.mollie.com/v2/settlements?limit=' + (checkAll ? 250 : 14), {
            headers: {
                Authorization: 'Bearer ' + token,
            },
        });
        if (request.status === 200) {
            // get data
            try {
                const data = request.data;
                // Read the data

                if (data._embedded?.settlements) {
                    const settlements = data._embedded.settlements as MollieSettlement[];

                    for (const settlement of settlements) {
                        if (settlement.settledAt === null) {
                            // Skip: this is the open settlement
                            continue;
                        }

                        const settledAt = new Date(settlement.settledAt);

                        if (isNaN(settledAt.getTime())) {
                            console.error('Received an invalid settledAt from Mollie', settlement, 'for token', token);
                            continue;
                        }

                        if (checkAll || settledAt > d) {
                            await updateSettlement(token, settlement, organizationId);
                        }
                    }
                } else {
                    console.error('Unreadable settlements');
                }
            } catch (e) {
                console.error(request.data);
                throw e;
            }
        } else {
            console.error('Failed to fetch settlements');
            console.error(request.data);
        }
    } catch (e) {
        console.error(e);
    }
}

async function updateSettlement(token: string, settlement: MollieSettlement, organizationId: string) {
    const settlementRow = await SettlementService.upsertSettlement({
        provider: PaymentProvider.Mollie,
        externalId: settlement.id,
        stripeAccountId: null,
        organizationId,
        reference: settlement.reference,
        amount: mollieAmountToUnits(settlement.amount.value),
        status: getMollieSettlementStatus(settlement.status),
        settledAt: new Date(settlement.settledAt),
    });

    const state: SettlementSyncState = {
        settlementRow,
        reported: new ReportedRows(),
    };

    try {
        // Regular payments settled in this settlement
        await updateSettlementResource(token, settlement, 'payments', state);

        // Refunds settled in this settlement. These are negative entries linked to a refund payment
        // (created by the mollie-refunds cron), so we can set their settlement metadata too.
        await updateSettlementResource(token, settlement, 'refunds', state);

        // Chargebacks settled in this settlement. Like refunds, these are negative entries linked to a
        // chargeback payment (created by the mollie-chargebacks cron).
        await updateSettlementResource(token, settlement, 'chargebacks', state);

        // Mollie's own costs, so the settlement reconciles to 0 like a Stripe one
        await storeMollieCosts(settlement, state);

        await SettlementService.sweepSettlement(settlementRow, state.reported);
        await SettlementService.finishSync(settlementRow, {
            transactionCount: state.reported.paymentLineExternalIds.size + state.reported.chargeExternalIds.size,
        });
    } catch (e) {
        await SettlementService.markSyncFailed(settlementRow);
        throw e;
    }
}

/**
 * Mollie invoices its costs per period: every cost line becomes a ProviderTransactionFee row plus
 * a Tax row for its VAT, carrying the settlement's invoiceId so they can be matched against the
 * invoice document.
 */
async function storeMollieCosts(settlement: MollieSettlement, state: SettlementSyncState) {
    for (const [year, months] of Object.entries(settlement.periods ?? {})) {
        for (const [month, period] of Object.entries(months)) {
            // Mollie states the period explicitly: that month is the cost's date, so the monthly
            // grouping stays derivable from occurredAt alone
            const occurredAt = new Date(parseInt(year), parseInt(month) - 1, 1);

            // A settlement can straddle a month boundary: each period can be billed on its own
            // invoice, the settlement-level id is only "the oldest invoice of all the periods"
            const invoiceId = period.invoiceId ?? settlement.invoiceId;

            for (const cost of period.costs ?? []) {
                // Mollie aggregates cost lines per description + method, so that pair identifies
                // the line within the period (hashed to keep the externalId short)
                const hash = createHash('sha256').update(cost.description + ':' + (cost.method ?? '')).digest('hex').slice(0, 16);
                const externalId = settlement.id + ':' + year + '-' + month + ':cost:' + hash;
                const description = cost.description + (cost.method ? ' (' + cost.method + ')' : '');

                const rows = [
                    { type: SettlementChargeType.ProviderTransactionFee, externalId, amount: -mollieAmountToUnits(cost.amountNet.value) },
                    ...(cost.amountVat && mollieAmountToUnits(cost.amountVat.value) !== 0
                        ? [{ type: SettlementChargeType.Tax, externalId: externalId + ':tax', amount: -mollieAmountToUnits(cost.amountVat.value) }]
                        : []),
                ];

                for (const row of rows) {
                    const charge = await SettlementService.upsertCharge({
                        ...row,
                        settlementId: state.settlementRow.id,
                        organizationId: state.settlementRow.organizationId,
                        ...(invoiceId ? { providerInvoiceId: invoiceId } : {}),
                        description,
                        occurredAt,
                    });
                    state.reported.charge(charge);
                }
            }
        }
    }
}

/**
 * Loop over all entries (payments, refunds or chargebacks) that are part of a settlement and set the
 * settlement metadata on the matching local payment. Every resource exposes its entries under
 * `_embedded[resource]` and uses the same pagination, so they share this logic.
 */
async function updateSettlementResource(token: string, settlement: MollieSettlement, resource: 'payments' | 'refunds' | 'chargebacks', state: SettlementSyncState, fromId?: string) {
    const limit = 250;

    const request = await axios.get('https://api.mollie.com/v2/settlements/' + settlement.id + '/' + resource + '?limit=' + limit + (fromId ? ('&from=' + encodeURIComponent(fromId)) : ''), {
        headers: {
            Authorization: 'Bearer ' + token,
        },
    });

    if (request.status === 200) {
        const entries = request.data._embedded[resource] as MollieSettlementEntryJSON[];

        for (const entry of entries) {
            await applySettlementToPayment(settlement, entry.id, state);
        }

        // Check next page
        if (request.data._links.next && entries.length > 0) {
            await updateSettlementResource(token, settlement, resource, state, entries[entries.length - 1].id);
        }
    } else {
        console.error(request.data);
    }
}

/**
 * Find the local payment linked to a Mollie payment or refund id and store the settlement metadata.
 * Entries without a local payment belong to a different system on the same Mollie account: they are
 * skipped, and the settlement's unexplainedAmount shows the gap.
 */
async function applySettlementToPayment(settlement: MollieSettlement, mollieId: string, state: SettlementSyncState) {
    // Search payment
    const mps = await MolliePayment.where({ mollieId });
    if (mps.length === 1) {
        const mp = mps[0];
        const payment = await Payment.getByID(mp.paymentId);
        if (payment) {
            state.reported.paymentLine(await SettlementService.upsertPaymentLine(state.settlementRow, {
                paymentId: payment.id,
                amount: payment.price,
                externalId: mollieId,
                occurredAt: new Date(settlement.settledAt),
            }));

            payment.settlement = SettlementReference.create({
                id: settlement.id,
                reference: settlement.reference,
                settledAt: new Date(settlement.settledAt),
                amount: mollieAmountToUnits(settlement.amount.value),
            });
            const saved = await payment.save();

            if (saved) {
                // Mark order as 'updated', or the frontend won't pull in the updates
                const order = await Order.getForPayment(null, payment.id);
                if (order) {
                    order.updatedAt = new Date();
                    order.forceSaveProperty('updatedAt');
                    await order.save();
                }

                // TODO: Mark registrations as 'saved'
            }

            if (STAMHOOFD.environment === 'development') {
                console.log('Updated settlement of payment ' + payment.id);
                console.log(payment.settlement);
            }
        } else {
            console.log('Missing payment ' + mp.paymentId);
        }
    } else {
        // Probably a payment in a different system/platform
        // console.log("No mollie payment found for id "+mollieId)
    }
}
