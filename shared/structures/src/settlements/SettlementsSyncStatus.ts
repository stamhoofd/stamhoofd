import { AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

/**
 * Progress of a running settlements sync (see SettlementsSyncEndpoint).
 */
export class SettlementsSyncStatus extends AutoEncoder {
    @field({ decoder: DateDecoder })
    start: Date;

    @field({ decoder: DateDecoder, nullable: true })
    end: Date | null = null;

    @field({ decoder: BooleanDecoder })
    force = false;

    /**
     * Settlements processed so far (synced + skipped + failed).
     */
    @field({ decoder: IntegerDecoder })
    count = 0;

    @field({ decoder: IntegerDecoder })
    failed = 0;
}
