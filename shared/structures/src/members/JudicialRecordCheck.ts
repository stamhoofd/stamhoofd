import { ArrayDecoder, AutoEncoder, EnumDecoder, field, StringDecoder } from '@common/encoding';

/** The automatic checks on a delivered judicial record extract, in the order they are shown. */
export enum JudicialRecordCheck {
    /** Really signed by FOD Justitie, and unchanged since. */
    Authentic = 'Authentic',

    /** Model 596.2, the extract for activities with minors. */
    Model = 'Model',

    /** The name and birth date printed on the extract are the member's. */
    Identity = 'Identity',

    /** Recent enough, and drawn up the day it was signed. */
    Age = 'Age',

    /** No convictions, as of the day the extract was drawn up. */
    EmptyRecord = 'EmptyRecord',
}

export const judicialRecordChecksInOrder: readonly JudicialRecordCheck[] = [
    JudicialRecordCheck.Authentic,
    JudicialRecordCheck.Model,
    JudicialRecordCheck.Identity,
    JudicialRecordCheck.Age,
    JudicialRecordCheck.EmptyRecord,
];

export enum JudicialRecordCheckStatus {
    Passed = 'Passed',
    Failed = 'Failed',

    /**
     * No verdict: not run yet, waiting on FOD Justitie, or impossible to perform at all - when the
     * signature does not hold, the text of the document is never read.
     *
     * Separate from Failed because reporting the four content checks as failures over one signature
     * would tell someone four things are wrong with their document when only one is. Nothing is
     * approved on a pending check either, so the distinction costs no safety.
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
     * A sentence rather than a code because the packages underneath already answer with a message
     * meant for whoever uploaded the file, and reducing those outcomes to codes to re-word them
     * elsewhere would throw away the part that tells someone what to do about it. Written on the way
     * out, so not meant to be stored and shown again later.
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

export class JudicialRecordCheckReport extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(JudicialRecordCheckResult) })
    checks: JudicialRecordCheckResult[] = [];

    get(check: JudicialRecordCheck): JudicialRecordCheckResult | null {
        return this.checks.find(result => result.check === check) ?? null;
    }

    /** In display order, leaving out the checks there is no result for. */
    getChecks(): JudicialRecordCheckResult[] {
        return judicialRecordChecksInOrder.flatMap(check => this.get(check) ?? []);
    }

    /** Every check has a result and that result passed, so a missing result is not a pass. */
    get isPassed(): boolean {
        return judicialRecordChecksInOrder.every(check => this.get(check)?.isPassed === true);
    }

    get failedChecks(): JudicialRecordCheckResult[] {
        return this.getChecks().filter(result => result.isFailed);
    }
}
