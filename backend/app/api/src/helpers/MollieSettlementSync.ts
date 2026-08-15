import type { MollieToken } from '@stamhoofd/models';
import { MolliePayment, Payment } from '@stamhoofd/models';
import type { Settlement } from '@stamhoofd/models/models/Settlement.js';
import type { AbortSignal } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import axios from 'axios';
import { createHash } from 'crypto';

import { SettlementService } from '../services/SettlementService.js';
import type { SettlementSyncSummary } from './ProviderSettlementSyncRunner.js';

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
        currency: string;
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
 * Everything one settlement walk needs to share between the resource pages.
 */
type SettlementSyncState = {
    settlementRow: Settlement;

    transactionCount: 0;

    /**
     * Stops the walk at the next entry (a restart).
     */
    abort: AbortSignal;
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

/**
 * Walks the settlements of one Mollie account and stores every entry in them: payments, refunds
 * and chargebacks become payment_settlements rows, Mollie's own costs become settlement_charges
 * rows, and the legacy blob is written in the same pass. Every settlement row written belongs to
 * the organization that owns the token's account.
 */
export class MollieSettlementSync {
    private token: MollieToken;

    constructor({ token }: { token: MollieToken }) {
        this.token = token;
    }

    /**
     * Walk the settlements newest first, until they settle before `start`.
     */
    async syncSettlements({ start, end = new Date(), summary, abort }: {
        start: Date;
        end?: Date;
        summary?: SettlementSyncSummary;
        abort?: AbortSignal;
    }): Promise<void> {
        let url: string | null = 'https://api.mollie.com/v2/settlements?limit=250';

        while (url) {
            abort?.throwIfAborted();

            const request = await this.#get(url);

            if (request.status !== 200) {
                console.error('Failed to fetch settlements');
                console.error(request.data);
                return;
            }

            const settlements = request.data._embedded?.settlements as MollieSettlement[] | undefined;
            if (!settlements) {
                console.error('Unreadable settlements');
                return;
            }

            for (const settlement of settlements) {
                abort?.throwIfAborted();

                if (settlement.settledAt === null) {
                    // Skip: this is the open settlement
                    continue;
                }

                const settledAt = new Date(settlement.settledAt);

                if (isNaN(settledAt.getTime())) {
                    console.error('Received an invalid settledAt from Mollie', settlement, 'for organization', this.token.organizationId);
                    continue;
                }

                if (settledAt.getTime() > end.getTime()) {
                    continue;
                }

                if (settledAt.getTime() < start.getTime()) {
                    // The list is newest-first: everything from here on settled before the window
                    return;
                }

                try {
                    await SettlementService.lock(PaymentProvider.Mollie, settlement.id, signal => this.#syncSettlement(settlement, signal), { abort });
                    if (summary) {
                        summary.synced += 1;
                    }
                } catch (e) {
                    // An interrupted settlement is not a failing settlement
                    abort?.throwIfAborted();

                    console.error('Sync of Mollie settlement ' + settlement.id + ' failed', e);
                    if (summary) {
                        summary.failed += 1;
                    }
                }
            }

            const next = request.data._links?.next?.href as string | undefined;
            url = (settlements.length > 0 && next) ? next : null;
        }
    }

    /**
     * The token can expire during a long walk: refresh it (if needed) before every request.
     */
    async #get(url: string) {
        await this.token.refreshIfNeeded();
        return await axios.get(url, {
            headers: {
                Authorization: 'Bearer ' + this.token.accessToken,
            },
        });
    }

    async #syncSettlement(settlement: MollieSettlement, abort: AbortSignal) {
        const settlementRow = await SettlementService.upsertSettlement({
            provider: PaymentProvider.Mollie,
            externalId: settlement.id,
            stripeAccountId: null,
            organizationId: this.token.organizationId,
            reference: settlement.reference,
            amount: mollieAmountToUnits(settlement.amount.value),
            status: getMollieSettlementStatus(settlement.status),
            settledAt: new Date(settlement.settledAt),
        });

        const state: SettlementSyncState = {
            settlementRow,
            transactionCount: 0,
            abort,
        };

        try {
            // Regular payments settled in this settlement
            await this.#syncResource(settlement, 'payments', state);

            // Refunds settled in this settlement. These are negative entries linked to a refund payment
            // (created by the mollie-refunds cron), so we can set their settlement metadata too.
            await this.#syncResource(settlement, 'refunds', state);

            // Chargebacks settled in this settlement. Like refunds, these are negative entries linked to a
            // chargeback payment (created by the mollie-chargebacks cron).
            await this.#syncResource(settlement, 'chargebacks', state);

            // Mollie's own costs, so the settlement reconciles to 0 like a Stripe one
            await this.#storeMollieCosts(settlement, state);

            await SettlementService.finishSync(settlementRow, {
                transactionCount: state.transactionCount,
            });
        } catch (e) {
            // A walk that was interrupted stored only part of the settlement: it has to be walked
            // again, but it didn't fail
            if (abort.isAborted) {
                await SettlementService.markSyncInterrupted(settlementRow);
            } else {
                await SettlementService.markSyncFailed(settlementRow);
            }
            throw e;
        }
    }

    /**
     * Mollie invoices its costs per period: every cost line becomes a ProviderTransactionFee row plus
     * a Tax row for its VAT, carrying the settlement's invoiceId so they can be matched against the
     * invoice document.
     */
    async #storeMollieCosts(settlement: MollieSettlement, state: SettlementSyncState) {
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
                        await SettlementService.upsertCharge({
                            ...row,
                            settlementId: state.settlementRow.id,
                            organizationId: state.settlementRow.organizationId,
                            ...(invoiceId ? { providerInvoiceId: invoiceId } : {}),
                            description,
                            occurredAt,
                        });
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
    async #syncResource(settlement: MollieSettlement, resource: 'payments' | 'refunds' | 'chargebacks', state: SettlementSyncState, fromId?: string) {
        const limit = 250;

        const request = await this.#get('https://api.mollie.com/v2/settlements/' + settlement.id + '/' + resource + '?limit=' + limit + (fromId ? ('&from=' + encodeURIComponent(fromId)) : ''));

        if (request.status === 200) {
            const entries = request.data._embedded[resource] as MollieSettlementEntryJSON[];

            for (const entry of entries) {
                // Between two entries is a safe point to stop: the settlement only claims to be
                // synced after the sweep, so an interrupted walk is re-walked from the start
                state.abort.throwIfAborted();

                await this.#applySettlementToPayment(settlement, entry.id, state);
            }

            // Check next page
            if (request.data._links.next && entries.length > 0) {
                await this.#syncResource(settlement, resource, state, entries[entries.length - 1].id);
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
    async #applySettlementToPayment(settlement: MollieSettlement, mollieId: string, state: SettlementSyncState) {
        // Search payment
        state.transactionCount += 1;
        const mps = await MolliePayment.where({ mollieId });
        if (mps.length === 1) {
            const mp = mps[0];
            const payment = await Payment.getByID(mp.paymentId);
            if (payment) {
                // A payment is only ever settled by the payouts of its own organization. The
                // platform's own Mollie account can reach payments of other systems on the same
                // token, and those may not be linked here
                if (payment.organizationId !== state.settlementRow.organizationId) {
                    console.log('Skipped payment ' + payment.id + ' of another organization in Mollie settlement ' + settlement.id);
                    return;
                }

                await SettlementService.upsertPaymentLine(state.settlementRow, {
                    paymentId: payment.id,
                    amount: payment.price,
                    externalId: mollieId,
                    occurredAt: new Date(settlement.settledAt),
                });

                // The blob is written from the stored rows, so it stays deterministic across
                // re-syncs and keeps its scoping rules in one place
                await SettlementService.updateLegacySettlementReference(payment);
            } else {
                console.log('Missing payment ' + mp.paymentId);
            }
        } else {
            // Probably a payment in a different system/platform
            // console.log("No mollie payment found for id "+mollieId)
        }
    }
}
