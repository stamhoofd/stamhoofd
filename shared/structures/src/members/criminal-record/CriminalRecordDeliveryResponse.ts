import { ArrayDecoder, AutoEncoder, EnumDecoder, field } from '@common/encoding';
import { CriminalRecordCheck, CriminalRecordCheckResult } from './CriminalRecordCheckResult.js';
import { CriminalRecordStatus } from './CriminalRecordStatus.js';

/**
 * What the delivery endpoint returns: the resulting status and the checks behind it.
 *
 * The results are never stored: a reviewer opening the document gets them recomputed.
 */
export class CriminalRecordDeliveryResponse extends AutoEncoder {
    @field({ decoder: new EnumDecoder(CriminalRecordStatus) })
    status: CriminalRecordStatus;

    @field({ decoder: new ArrayDecoder(CriminalRecordCheckResult) })
    checks: CriminalRecordCheckResult[] = [];

    /**
     * The checks a member may see. The member never learns that an extract is not blank: a document
     * that only fails that check goes straight to a reviewer.
     */
    getMemberVisibleChecks(): CriminalRecordCheckResult[] {
        return this.checks.filter(c => c.check !== CriminalRecordCheck.Blank);
    }
}
