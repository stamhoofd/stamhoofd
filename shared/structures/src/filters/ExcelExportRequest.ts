import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { LimitedFilteredRequest } from './FilteredRequest.js';

export enum ExcelExportType {
    Payments = 'payments',
    Members = 'members',
    Organizations = 'organizations',
}

export class ExcelSheetColumnFilter extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;
}

export class ExcelSheetFilter extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder, ...NextVersion })
    name: string = '';

    @field({ decoder: new ArrayDecoder(ExcelSheetColumnFilter), ...NextVersion, upgrade: (old: string[]) => old.map(id => ExcelSheetColumnFilter.create({ id, name: '' })) })
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    columns: ExcelSheetColumnFilter[] = [];
}

/**
 * Which sheets and columns to include in the excel file
 */
export class ExcelWorkbookFilter extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(ExcelSheetFilter) })
    sheets: ExcelSheetFilter[] = [];
}

export class ExcelExportRequest extends AutoEncoder {
    @field({ decoder: LimitedFilteredRequest })
    filter: LimitedFilteredRequest;

    @field({ decoder: ExcelWorkbookFilter })
    workbookFilter: ExcelWorkbookFilter;
}

export class ExcelExportResponse extends AutoEncoder {
    /**
     * Contains a file id which can be used to download the file
     *
     * If this is null, the file will be sent via e-mail
     */
    @field({ decoder: StringDecoder, nullable: true })
    url: string | null = null;
}
