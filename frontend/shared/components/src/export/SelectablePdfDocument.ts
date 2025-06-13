import { PdfDocumentsFilter } from '@stamhoofd/structures';
import { SelectablePdfSheet } from './SelectablePdfSheet';

export class SelectablePdfDocument<T> {
    readonly sheets: SelectablePdfSheet<T>[] = [];

    get size() {
        return this.sheets.length;
    }

    constructor(data: { sheets: SelectablePdfSheet<T>[] }) {
        this.sheets = data.sheets;
    }

    disableAll(): void {
        this.sheets.forEach(d => d.disableAll());
    }

    from(filter: PdfDocumentsFilter): void {
        this.disableAll();

        for (const documentFilter of filter.documents) {
            const document = this.sheets.find(document => document.id === documentFilter.id);
            if (!document) {
                continue;
            }

            document.from(documentFilter);
        }
    }

    getFilter(): PdfDocumentsFilter {
        return PdfDocumentsFilter.create({
            documents: this.sheets.flatMap((document) => {
                if (!document.enabled) {
                    return [];
                }

                return [document.getFilter()];
            }),
        });
    }
}
