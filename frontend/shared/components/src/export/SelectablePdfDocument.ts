import { SelectablePdfDocumentFilter } from '@stamhoofd/structures';
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

    from(filter: SelectablePdfDocumentFilter): void {
        this.disableAll();

        for (const sheetsFilter of filter.sheets) {
            const sheet = this.sheets.find(document => document.id === sheetsFilter.id);
            if (!sheet) {
                continue;
            }

            sheet.from(sheetsFilter);
        }
    }

    getFilter(): SelectablePdfDocumentFilter {
        return SelectablePdfDocumentFilter.create({
            sheets: this.sheets.flatMap((document) => {
                if (!document.enabled) {
                    return [];
                }

                return [document.getFilter()];
            }),
        });
    }
}
