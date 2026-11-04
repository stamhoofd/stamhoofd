import { ArrayDecoder, AutoEncoder, EnumDecoder, field } from '@common/encoding';
import { JudicialRecordCheck, JudicialRecordCheckResult } from './JudicialRecordCheckResult.js';
import { JudicialRecordStatus } from './JudicialRecordStatus.js';

/** The resulting status and the checks behind it. Never stored: a reviewer gets them recomputed. */
export class JudicialRecordDeliveryResponse extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordStatus) })
    status: JudicialRecordStatus;

    @field({ decoder: new ArrayDecoder(JudicialRecordCheckResult) })
    checks: JudicialRecordCheckResult[] = [];

    /**
     * The member never learns that an extract is not blank: a document that only fails that check
     * goes straight to a reviewer.
     */
    getMemberVisibleChecks(): JudicialRecordCheckResult[] {
        return this.checks.filter(c => c.check !== JudicialRecordCheck.Blank);
    }
}
