import { AutoEncoder, EnumDecoder, field, RecordDecoder, StringDecoder } from '@common/encoding';

/** In the order they are shown. */
export enum JudicialRecordCheck {
    /** A genuine extract from FOD Justitie. */
    Authentic = 'Authentic',
    /** Name and birth date match the member. */
    Identity = 'Identity',
    /** Model 596.2: the extract for activities with minors. */
    Model = 'Model',
    /** Not older than one month on the day it was delivered. */
    Age = 'Age',
    /** A blank judicial record. Never shown to the member. */
    Blank = 'Blank',
}

export enum JudicialRecordCheckStatus {
    Passed = 'Passed',
    Failed = 'Failed',
    /** Still running, for example while the document is fetched at FOD Justitie. */
    Busy = 'Busy',
    /** Could not run, because an earlier check did not deliver what it needs. */
    NotStarted = 'NotStarted',
}

/**
 * An enum instead of a sentence, so the reader's language decides the wording and a language switch
 * cannot leave Dutch text in a French interface.
 */
export enum JudicialRecordCheckExplanation {
    /** The signature of FOD Justitie was verified on the uploaded pdf. */
    SignedByJustice = 'SignedByJustice',
    /** The document was downloaded at FOD Justitie through the scanned QR code. */
    FetchedViaQrCode = 'FetchedViaQrCode',
    /**
     * The file is not an unmodified pdf signed by FOD Justitie. Params: `code` - which step of the
     * verification refused it, for support and for noticing a certificate rotation.
     */
    SignatureInvalid = 'SignatureInvalid',

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

export class JudicialRecordCheckResult extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordCheck) })
    check: JudicialRecordCheck;

    @field({ decoder: new EnumDecoder(JudicialRecordCheckStatus) })
    status: JudicialRecordCheckStatus;

    @field({ decoder: new EnumDecoder(JudicialRecordCheckExplanation), nullable: true })
    explanation: JudicialRecordCheckExplanation | null = null;

    @field({ decoder: new RecordDecoder(StringDecoder, StringDecoder) })
    explanationParams: Record<string, string> = {};

    get isPassed() {
        return this.status === JudicialRecordCheckStatus.Passed;
    }

    get isFailed() {
        return this.status === JudicialRecordCheckStatus.Failed;
    }
}
