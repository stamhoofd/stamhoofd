export type SettlementSyncSummary = {
    feeMonths: number;
    failedFeeMonths: number;
    synced: number;
    skipped: number;
    failed: number;
};

export type ProviderSyncRunOptions = {
    /**
     * Sync settlements settled at or after this date...
     */
    start: Date;

    /**
     * ...and at or before this date.
     */
    end: Date;

    /**
     * Mutated in place, shared across providers so one run reports one total.
     */
    summary: SettlementSyncSummary;

    /**
     * Fired after each unit of work (a month for Stripe, an account for Mollie).
     */
    onProgress?: () => void;
};

/**
 * One provider's settlement walk. Constructor = provider-specific configuration; run = uniform
 * execution over a window. Every run option applies to every implementation.
 */
export interface ProviderSettlementSyncRunner {
    run(options: ProviderSyncRunOptions): Promise<void>;
}
