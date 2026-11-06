import { ArrayDecoder, AutoEncoder, EnumDecoder, field, StringDecoder } from '@common/encoding';

/**
 * The automatic checks we run on a delivered judicial record extract, in the order they are shown.
 *
 * Five of them, but the person who delivered the extract only ever sees the first four: whether a
 * record is blank is between them and a reviewer.
 */
export enum JudicialRecordCheck {
    /**
     * Really signed by FOD Justitie, and unchanged since. Covers the whole signature pipeline:
     * which bytes the signature covers, the signature itself, the pinned signer, the certificate
     * chain and revocation.
     */
    Authentic = 'Authentic',

    /** The name and birth date printed on the extract are the member's. */
    Identity = 'Identity',

    /** Model 596.2: the extract for activities with minors. */
    Model = 'Model',

    /**
     * Recent enough, and drawn up the day it was signed. The second half is what keeps the first
     * honest: the date in the header is printed text, the signing time is covered by the signature.
     */
    Age = 'Age',

    /** Blank, as of the day the extract was drawn up. */
    Blank = 'Blank',
}

export const judicialRecordChecksInOrder: readonly JudicialRecordCheck[] = [
    JudicialRecordCheck.Authentic,
    JudicialRecordCheck.Identity,
    JudicialRecordCheck.Model,
    JudicialRecordCheck.Age,
    JudicialRecordCheck.Blank,
];

export enum JudicialRecordCheckStatus {
    Passed = 'Passed',
    Failed = 'Failed',

    /**
     * No verdict. The check has not run yet, is waiting on FOD Justitie, or could not be performed
     * at all - when the signature does not hold, the text of the document is never read.
     *
     * Three states, not two, because a check without a verdict is not a check that failed. Marking
     * the four content checks as failures because a signature did not hold would tell someone four
     * things are wrong with their document when only one is. Nothing is approved on a pending check
     * either, so the distinction costs no safety.
     */
    Pending = 'Pending',
}

export class JudicialRecordCheckResult extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordCheck) })
    check: JudicialRecordCheck;

    @field({ decoder: new EnumDecoder(JudicialRecordCheckStatus) })
    status: JudicialRecordCheckStatus = JudicialRecordCheckStatus.Pending;

    /**
     * Why it landed this way, as a sentence, in the language of the request that produced it.
     *
     * The checks lean on two packages that already answer with a message meant for whoever uploaded
     * the file - which step of the signature refused it, which limit a pdf did not fit. Reducing
     * those dozens of outcomes to a handful of codes to re-word them elsewhere would throw away the
     * part that actually tells someone what to do about it.
     */
    @field({ decoder: StringDecoder })
    reason: string = '';

    get isPassed(): boolean {
        return this.status === JudicialRecordCheckStatus.Passed;
    }

    get isFailed(): boolean {
        return this.status === JudicialRecordCheckStatus.Failed;
    }
}

/** The outcome of the automatic control: one result per check. */
export class JudicialRecordCheckReport extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(JudicialRecordCheckResult) })
    checks: JudicialRecordCheckResult[] = [];

    get(check: JudicialRecordCheck): JudicialRecordCheckResult | null {
        return this.checks.find(result => result.check === check) ?? null;
    }

    /**
     * Returns the results in display order, leaving out the checks there is no result for. Pass
     * `includeBlank: false` for the member themselves.
     */
    getChecks(includeBlank: boolean): JudicialRecordCheckResult[] {
        const order = includeBlank
            ? judicialRecordChecksInOrder
            : judicialRecordChecksInOrder.filter(check => check !== JudicialRecordCheck.Blank);

        return order.flatMap(check => this.get(check) ?? []);
    }

    /** Every check has a result and that result passed. */
    get isPassed(): boolean {
        return judicialRecordChecksInOrder.every(check => this.get(check)?.isPassed === true);
    }

    get failedChecks(): JudicialRecordCheckResult[] {
        return this.getChecks(true).filter(result => result.isFailed);
    }
}
