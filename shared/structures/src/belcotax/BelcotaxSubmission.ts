import {
    ArrayDecoder,
    AutoEncoder,
    BooleanDecoder,
    DateDecoder,
    EnumDecoder,
    field,
    IntegerDecoder,
    StringDecoder,
} from '@common/encoding';
import { v4 as uuidv4 } from 'uuid';

import { JsonlExportResult } from '../JsonlExport.js';
import { BelcotaxConnection } from './BelcotaxConnection.js';

export enum BelcotaxSubmissionStatus {
    /**
     * We are sending the file
     */
    Sending = 'Sending',
    /**
     * Belcotax accepted the format and is checking its business rules
     */
    Validating = 'Validating',
    Accepted = 'Accepted',
    /**
     * Format errors (right away, without a bulk id) or business errors. Belcotax refuses the whole file.
     */
    Rejected = 'Rejected',
    /**
     * No result within 24 hours, or the result can no longer be asked for: sending again is safe
     */
    Unknown = 'Unknown',
    /**
     * The file did not reach Belcotax, or we don't know whether it did (time-out)
     */
    Failed = 'Failed',
}

/**
 * The last submission a document was part of. Null when it was never sent.
 */
export enum BelcotaxDocumentStatus {
    Sent = 'Sent',
    Accepted = 'Accepted',
    Rejected = 'Rejected',
}

export class BelcotaxDocumentStatusHelper {
    static getName(status: BelcotaxDocumentStatus | null): string {
        switch (status) {
            case null:
                return $t('Niet verstuurd');
            case BelcotaxDocumentStatus.Sent:
                return $t('Verstuurd');
            case BelcotaxDocumentStatus.Accepted:
                return $t('Aanvaard');
            case BelcotaxDocumentStatus.Rejected:
                return $t('Geweigerd');
        }
    }

    static getColor(status: BelcotaxDocumentStatus | null): string {
        switch (status) {
            case null:
                return 'gray';
            case BelcotaxDocumentStatus.Sent:
                return 'info';
            case BelcotaxDocumentStatus.Accepted:
                return 'success';
            case BelcotaxDocumentStatus.Rejected:
                return 'error';
        }
    }
}

export class BelcotaxSubmissionStatusHelper {
    static getName(status: BelcotaxSubmissionStatus): string {
        switch (status) {
            case BelcotaxSubmissionStatus.Sending:
                return $t('Wordt verstuurd');
            case BelcotaxSubmissionStatus.Validating:
                return $t('Wordt gecontroleerd');
            case BelcotaxSubmissionStatus.Accepted:
                return $t('Aanvaard');
            case BelcotaxSubmissionStatus.Rejected:
                return $t('Geweigerd');
            case BelcotaxSubmissionStatus.Unknown:
                return $t('Resultaat onbekend');
            case BelcotaxSubmissionStatus.Failed:
                return $t('Niet verstuurd');
        }
    }

    static getColor(status: BelcotaxSubmissionStatus): string {
        switch (status) {
            case BelcotaxSubmissionStatus.Sending:
            case BelcotaxSubmissionStatus.Validating:
                return 'info';
            case BelcotaxSubmissionStatus.Accepted:
                return 'success';
            case BelcotaxSubmissionStatus.Rejected:
            case BelcotaxSubmissionStatus.Failed:
                return 'error';
            case BelcotaxSubmissionStatus.Unknown:
                return 'warn';
        }
    }

    static isOpen(status: BelcotaxSubmissionStatus) {
        return (
            status === BelcotaxSubmissionStatus.Sending ||
            status === BelcotaxSubmissionStatus.Validating
        );
    }
}

/**
 * An error Belcotax returned. documentId is null when it is not about one document (organiser, contact, certifier
 * or a line we could not map).
 */
export class BelcotaxSubmissionIssue extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    documentId: string | null = null;

    /**
     * The child and activity of the document, e.g. "Lena Peeters, Kamp 2026"
     */
    @field({ decoder: StringDecoder, nullable: true })
    documentDescription: string | null = null;

    /**
     * Key of the fiche or resource, as Belcotax returned it
     */
    @field({ decoder: StringDecoder, nullable: true })
    key: string | null = null;

    @field({ decoder: IntegerDecoder, nullable: true })
    line: number | null = null;

    /**
     * Name of the Belcotax rule, e.g. "organisationDeclarantCbeFiches"
     */
    @field({ decoder: StringDecoder })
    code = '';

    /**
     * Explanation of Belcotax, in Dutch
     */
    @field({ decoder: StringDecoder })
    message = '';
}

export class BelcotaxSubmission extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    templateId = '';

    @field({ decoder: StringDecoder })
    companyNumber = '';

    @field({ decoder: new EnumDecoder(BelcotaxSubmissionStatus) })
    status = BelcotaxSubmissionStatus.Sending;

    /**
     * The id Belcotax gave the file. Null when it was refused right away because of format errors.
     */
    @field({ decoder: StringDecoder, nullable: true })
    bulkId: string | null = null;

    /**
     * New and changed documents
     */
    @field({ decoder: IntegerDecoder })
    ficheCount = 0;

    /**
     * Deleted documents, unless Belcotax already accepted their deletion
     */
    @field({ decoder: IntegerDecoder })
    deletedCount = 0;

    /**
     * Name of the administrator who submitted
     */
    @field({ decoder: StringDecoder })
    submittedBy = '';

    @field({ decoder: new ArrayDecoder(BelcotaxSubmissionIssue) })
    issues: BelcotaxSubmissionIssue[] = [];

    /**
     * Why it failed or the result is unknown
     */
    @field({ decoder: StringDecoder, nullable: true })
    errorMessage: string | null = null;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    finishedAt: Date | null = null;

    get isOpen() {
        return BelcotaxSubmissionStatusHelper.isOpen(this.status);
    }

    get documentCount() {
        return this.ficheCount + this.deletedCount;
    }
}

/**
 * What "Doorsturen" would send for a template
 */
export class BelcotaxSubmitPreview extends AutoEncoder {
    /**
     * Never accepted by Belcotax
     */
    @field({ decoder: IntegerDecoder })
    newCount = 0;

    /**
     * Content differs from the version Belcotax accepted
     */
    @field({ decoder: IntegerDecoder })
    changedCount = 0;

    @field({ decoder: IntegerDecoder })
    deletedCount = 0;

    /**
     * Accepted by Belcotax and not changed since
     */
    @field({ decoder: IntegerDecoder })
    unchangedCount = 0;

    /**
     * The same check as the download. The file itself is left out.
     */
    @field({ decoder: JsonlExportResult })
    check = JsonlExportResult.create({});

    @field({ decoder: StringDecoder })
    companyNumber = '';

    /**
     * The entity with this company number in the settings, which is the one to connect. Null when the company
     * number was only filled in on the template.
     */
    @field({ decoder: StringDecoder, nullable: true })
    companyId: string | null = null;

    @field({ decoder: BelcotaxConnection, nullable: true })
    connection: BelcotaxConnection | null = null;

    /**
     * A submission for this template or company that has no result yet
     */
    @field({ decoder: BelcotaxSubmission, nullable: true })
    openSubmission: BelcotaxSubmission | null = null;

    get isConnected() {
        return !!this.connection?.isValid;
    }

    get sendCount() {
        return this.newCount + this.changedCount + this.deletedCount;
    }
}

/**
 * A document in a submission and the hash of what was sent, stored with the submission to update the documents
 * when the result arrives.
 */
export class BelcotaxSubmittedDocument extends AutoEncoder {
    @field({ decoder: StringDecoder })
    documentId = '';

    @field({ decoder: StringDecoder })
    hash = '';

    @field({ decoder: BooleanDecoder })
    deleted = false;
}

/**
 * Only kept on the server
 */
export class BelcotaxSubmissionContent extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(BelcotaxSubmittedDocument) })
    documents: BelcotaxSubmittedDocument[] = [];

    /**
     * The key of every line of the file: Belcotax returns format errors with a line number only
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    lineKeys: string[] = [];
}
