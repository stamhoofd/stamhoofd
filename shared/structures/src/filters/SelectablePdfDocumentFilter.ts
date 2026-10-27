import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@common/encoding';

export class SelectablePdfDataFilter extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;
}

export class SelectablePdfSheetFilter extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: new ArrayDecoder(SelectablePdfDataFilter) })
    items: SelectablePdfDataFilter[] = [];
}

export class SelectablePdfDocumentFilter extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(SelectablePdfSheetFilter) })
    sheets: SelectablePdfSheetFilter[] = [];
}
