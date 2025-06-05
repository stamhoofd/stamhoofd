import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class PdfItemFilter extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    category?: string | null = null;
}

export class PdfDocumentFilter extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string = '';

    @field({ decoder: new ArrayDecoder(PdfItemFilter) })
    items: PdfItemFilter[] = [];
}

export class PdfDocumentsFilter extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PdfDocumentFilter) })
    documents: PdfDocumentFilter[] = [];
}
