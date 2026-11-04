/** Derived from the stored facts and the member's current functions, never written to a column. */
export enum JudicialRecordStatus {
    /** No extract is required for this member. */
    NotRequired = 'NotRequired',

    /** An extract is required, but none has been delivered (or the previous decision expired). */
    Missing = 'Missing',

    /** Delivered via the QR code, but the document could not be fetched at FOD Justitie yet. */
    AutomaticCheckBusy = 'AutomaticCheckBusy',

    /** Delivered, but the automatic check could not approve it: a human has to decide. */
    UnderReview = 'UnderReview',

    Approved = 'Approved',
    ApprovedWithConditions = 'ApprovedWithConditions',

    /** Rejected by the automatic check. The document is kept, so the member can submit it anyway. */
    AutomaticallyRejected = 'AutomaticallyRejected',

    /** Rejected by a reviewer: the member has to deliver a new extract. */
    TemporarilyRejected = 'TemporarilyRejected',

    PermanentlyRejected = 'PermanentlyRejected',
}
