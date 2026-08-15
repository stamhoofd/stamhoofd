import type { MollieToken } from '@stamhoofd/models';
import { MolliePayment, Payment } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import type { Settlement } from '@stamhoofd/models/models/Settlement.js';
import type { AbortSignal } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import axios from 'axios';

import { SettlementService } from '../services/SettlementService.js';
import type { SettlementSyncSummary } from './ProviderSettlementSyncRunner.js';

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
};

type MollieAmount = {
    currency: string;
    value: string;
};

type MollieBalanceTransaction = {
    id: string;
    type: string;
    createdAt: string;

    /**
     * Everything Mollie withheld from the movement (negative): fees, but also reserves, partner
     * commissions and loan repayments. `deductionDetails` separates those.
     */
    deductions?: MollieAmount | null;
    deductionDetails?: {
        fees?: MollieAmount | null;
    } | null;
    context?: {
        paymentId?: string;
        refundId?: string;
        chargebackId?: string;
    } | null;
};

/**
 * A transaction occurs before the settlement that pays it out: up to a month (Mollie settles
 * daily, weekly or monthly) plus a few days of payout delay. The fee walk looks this much further
 * back than the settlement window.
 */
const TRANSACTION_FEE_LOOKBACK_MS = 45 * 24 * 60 * 60 * 1000;

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
 * Walks the settlements of one Mollie account: payments, refunds and chargebacks become
 * payment_settlements rows, and the legacy blob is written in the same pass. A second walk over
 * the balance transactions stores the fee Mollie deducted per transaction as a settlement_charges
 * row. Every row written belongs to the organization that owns the token's account.
 */
export class MollieSettlementSync {
    private token: MollieToken;

    constructor({ token }: { token: MollieToken }) {
        this.token = token;
    }

    async syncSettlements({ start, end = new Date(), summary, abort }: {
        start: Date;
        end?: Date;
        summary?: SettlementSyncSummary;
        abort?: AbortSignal;
    }): Promise<void> {
        // Fees attach to the settlement lines the first walk stores
        await this.#walkSettlements({ start, end, summary, abort });
        await this.#syncTransactionFees({ start, end, abort });
    }

    /**
     * Walk the settlements newest first, until they settle before `start`.
     */
    async #walkSettlements({ start, end, summary, abort }: {
        start: Date;
        end: Date;
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
     * Stores the fee of every settled payment, refund and chargeback, then recounts the
     * settlements that gained charges: their finishSync ran before the fees existed.
     */
    async #syncTransactionFees({ start, end, abort }: { start: Date; end: Date; abort?: AbortSignal }): Promise<void> {
        const touchedSettlementIds = new Set<string>();

        try {
            await this.#walkTransactionFees({ start, end, abort }, touchedSettlementIds);
        } catch (e) {
            // Recount what was stored before the walk broke, without hiding what broke it
            await SettlementService.refreshTotalsForIds([...touchedSettlementIds]).catch(console.error);
            throw e;
        }

        await SettlementService.refreshTotalsForIds([...touchedSettlementIds]);
    }

    /**
     * Walk the balance transactions newest first, until they occur before the window minus the
     * lookback.
     */
    async #walkTransactionFees({ start, end, abort }: { start: Date; end: Date; abort?: AbortSignal }, touchedSettlementIds: Set<string>): Promise<void> {
        const oldest = new Date(start.getTime() - TRANSACTION_FEE_LOOKBACK_MS);
        let url: string | null = 'https://api.mollie.com/v2/balances/primary/transactions?limit=250';

        while (url) {
            abort?.throwIfAborted();

            const request = await this.#get(url);

            if (request.status !== 200) {
                console.error('Failed to fetch balance transactions for organization', this.token.organizationId);
                console.error(request.data);
                return;
            }

            const transactions = request.data._embedded?.balance_transactions as MollieBalanceTransaction[] | undefined;
            if (!transactions) {
                console.error('Unreadable balance transactions');
                return;
            }

            for (const transaction of transactions) {
                abort?.throwIfAborted();

                const createdAt = new Date(transaction.createdAt);

                if (isNaN(createdAt.getTime())) {
                    console.error('Received an invalid balance transaction createdAt from Mollie', transaction, 'for organization', this.token.organizationId);
                    continue;
                }

                if (createdAt.getTime() > end.getTime()) {
                    continue;
                }

                if (createdAt.getTime() < oldest.getTime()) {
                    // The list is newest-first: everything from here on occurred before the window
                    return;
                }

                await this.#storeTransactionFee(transaction, createdAt, touchedSettlementIds);
            }

            const next = request.data._links?.next?.href as string | undefined;
            url = (transactions.length > 0 && next) ? next : null;
        }
    }

    /**
     * The settled entry a balance transaction belongs to. Every other transaction type (transfers,
     * reserves, corrections, ...) is ignored for now.
     */
    #getTransactionEntryId(transaction: MollieBalanceTransaction): string | null {
        switch (transaction.type) {
            case 'payment': return transaction.context?.paymentId ?? null;
            case 'refund': return transaction.context?.refundId ?? null;
            case 'chargeback': return transaction.context?.chargebackId ?? null;
            default: return null;
        }
    }

    /**
     * Store the fee Mollie deducted for one settled entry: a charge on the settlement the entry
     * was paid out in, linked to the local payment.
     */
    async #storeTransactionFee(transaction: MollieBalanceTransaction, createdAt: Date, touchedSettlementIds: Set<string>) {
        const entryId = this.#getTransactionEntryId(transaction);
        if (!entryId) {
            return;
        }

        // Reserves, commissions and repayments are not costs of this entry; a transaction without
        // the breakdown carries its whole deduction as fees
        const amount = mollieAmountToUnits(transaction.deductionDetails?.fees?.value ?? transaction.deductions?.value ?? '0');
        if (amount === 0) {
            return;
        }

        // No line: the entry belongs to a different system on the same account, or its settlement
        // isn't stored yet and a later walk revisits this transaction
        const line = await PaymentSettlement.select().where('externalId', entryId).first(false);
        if (!line) {
            return;
        }

        await SettlementService.upsertCharge({
            type: SettlementChargeType.ProviderTransactionFee,
            externalId: transaction.id,
            amount,
            settlementId: line.settlementId,
            paymentId: line.paymentId,
            organizationId: line.organizationId,
            occurredAt: createdAt,
        });
        touchedSettlementIds.add(line.settlementId);

        const payment = await Payment.getByID(line.paymentId);
        if (payment) {
            payment.transferFee = -amount;
            await payment.save();
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
