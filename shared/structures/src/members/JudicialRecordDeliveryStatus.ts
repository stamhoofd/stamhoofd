/**
 * What a delivered judicial record extract leaves behind: either the automatic checks settled it, or
 * a human has to look at it.
 *
 * There is no refused value. A delivery is refused by throwing, and only revocation does that — the
 * one thing the frontend could not already have worked out before the member chose to deliver.
 * Everything else the checks found was shown to them first, so refusing it here would refuse
 * something they were already told about.
 */
export enum JudicialRecordDeliveryStatus {
    /** Every automatic check passed, so nobody has to open the document. */
    AutoOk = 'AUTO_OK',

    /** At least one check has no verdict or did not pass, so a reviewer decides. */
    Manual = 'MANUAL',
}
