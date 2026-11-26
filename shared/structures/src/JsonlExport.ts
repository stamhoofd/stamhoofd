import { ArrayDecoder, AutoEncoder, field, IntegerDecoder, StringDecoder } from '@common/encoding';

/**
 * A reason why a document, or the whole export when documentId is null, cannot be sent to Belcotax.
 */
export class JsonlExportIssue extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    documentId: string | null = null;

    /**
     * The child and activity of the document, e.g. "Lena Peeters, Kamp 2026"
     */
    @field({ decoder: StringDecoder, nullable: true })
    documentDescription: string | null = null;

    @field({ decoder: StringDecoder })
    message = '';
}

/**
 * A document that is not in the file, without an issue of its own.
 */
export class JsonlExportDocument extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    /**
     * The child and activity of the document, e.g. "Lena Peeters, Kamp 2026"
     */
    @field({ decoder: StringDecoder })
    description = '';
}

/**
 * The JSON-lines file for Belcotax-on-web, built from the published documents of a fiscal template.
 * Documents with an issue are left out of the file.
 */
export class JsonlExportResult extends AutoEncoder {
    @field({ decoder: StringDecoder })
    jsonl = '';

    @field({ decoder: IntegerDecoder })
    documentCount = 0;

    @field({ decoder: IntegerDecoder })
    deletedCount = 0;

    @field({ decoder: new ArrayDecoder(JsonlExportIssue) })
    issues: JsonlExportIssue[] = [];

    /**
     * Documents with missing data: only published documents go in the file.
     */
    @field({ decoder: new ArrayDecoder(JsonlExportDocument) })
    incompleteDocuments: JsonlExportDocument[] = [];

    /**
     * Without an organiser or contact nothing can be sent, so there is no file to download.
     */
    get isBlocked() {
        return this.issues.some((issue) => issue.documentId === null);
    }
}
