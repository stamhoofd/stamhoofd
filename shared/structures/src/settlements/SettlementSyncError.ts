import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError } from '@simonbackx/simple-errors';

/**
 * One error of the last sync attempt of a settlement, stored on the settlement so failing payouts
 * can be inspected by querying the database instead of relying on emailed reports.
 */
export class SettlementSyncError extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    code: string | null = null;

    @field({ decoder: StringDecoder })
    message: string;

    /**
     * The provider transaction that failed; null for errors about the payout as a whole.
     */
    @field({ decoder: StringDecoder, nullable: true })
    transactionId: string | null = null;

    static fromError(error: unknown, { transactionId = null }: { transactionId?: string | null } = {}): SettlementSyncError {
        return SettlementSyncError.create({
            code: isSimpleError(error) ? error.code : null,
            message: error instanceof Error ? error.message : String(error),
            transactionId,
        });
    }
}
