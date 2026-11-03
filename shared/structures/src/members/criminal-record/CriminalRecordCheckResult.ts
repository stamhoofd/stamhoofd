import { AutoEncoder, EnumDecoder, field, RecordDecoder, StringDecoder } from '@common/encoding';

/**
 * The fixed list of checks the automatic control performs, in the order they are shown.
 */
export enum CriminalRecordCheck {
    /** A genuine extract from FOD Justitie. */
    Authentic = 'Authentic',
    /** Name and birth date match the member. */
    Identity = 'Identity',
    /** Model 596.2: the extract for activities with minors. */
    Model = 'Model',
    /** Not older than one month on the day it was delivered. */
    Age = 'Age',
    /** A blank criminal record. Never shown to the member. */
    Blank = 'Blank',
}

export enum CriminalRecordCheckStatus {
    Passed = 'Passed',
    Failed = 'Failed',
    /** The check is still running, for example while the document is fetched at FOD Justitie. */
    Busy = 'Busy',
    /** The check could not run yet, because an earlier check did not deliver what it needs. */
    NotStarted = 'NotStarted',
}

/**
 * Why a check has its status. An enum instead of a sentence, so the frontend renders it in the
 * language of the reader and a language switch cannot leave Dutch text in a French interface.
 */
export enum CriminalRecordCheckExplanation {
    /** The signature of FOD Justitie was verified on the uploaded pdf. */
    SignedByJustice = 'SignedByJustice',
    /** The document was downloaded at FOD Justitie through the scanned QR code. */
    FetchedViaQrCode = 'FetchedViaQrCode',
    /** The signature was not verified (yet). */
    SignatureNotVerified = 'SignatureNotVerified',

    IdentityMatches = 'IdentityMatches',
    /** Params: `name` - the name of the member the document should be about. */
    IdentityMismatch = 'IdentityMismatch',

    ModelMatches = 'ModelMatches',
    ModelMismatch = 'ModelMismatch',

    AgeWithinLimit = 'AgeWithinLimit',
    /** Params: `days` - how old the document may be. */
    AgeTooOld = 'AgeTooOld',

    IsBlank = 'IsBlank',
    IsNotBlank = 'IsNotBlank',

    /** The field this check needs was not found in the document. */
    FieldNotFound = 'FieldNotFound',
    /** The document itself could not be read automatically. Params: `code` - a parse error code. */
    DocumentNotReadable = 'DocumentNotReadable',
}

export class CriminalRecordCheckResult extends AutoEncoder {
    @field({ decoder: new EnumDecoder(CriminalRecordCheck) })
    check: CriminalRecordCheck;

    @field({ decoder: new EnumDecoder(CriminalRecordCheckStatus) })
    status: CriminalRecordCheckStatus;

    @field({ decoder: new EnumDecoder(CriminalRecordCheckExplanation), nullable: true })
    explanation: CriminalRecordCheckExplanation | null = null;

    @field({ decoder: new RecordDecoder(StringDecoder, StringDecoder) })
    explanationParams: Record<string, string> = {};

    get isPassed() {
        return this.status === CriminalRecordCheckStatus.Passed;
    }

    get isFailed() {
        return this.status === CriminalRecordCheckStatus.Failed;
    }
}
