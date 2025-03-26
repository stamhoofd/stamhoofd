import { ExcelSheetColumnFilter, ExcelSheetFilter, ExcelWorkbookFilter } from '@stamhoofd/structures';
import { SelectableSheet } from './SelectableSheet';

export class SelectableWorkbook {
    sheets: SelectableSheet[] = [];

    constructor(data: { sheets: SelectableSheet[] }) {
        this.sheets = data.sheets;
    }

    disableAll() {
        for (const sheet of this.sheets) {
            sheet.disableAll();
        }
    }

    from(filter: ExcelWorkbookFilter) {
        this.disableAll();

        for (const s of filter.sheets) {
            const sheet = this.sheets.find(sheet => sheet.id === s.id);
            if (!sheet) {
                continue;
            }

            sheet.withCategoryRow = false;

            for (const { id, category } of s.columns) {
                const column = sheet.columns.find(c => c.id === id);
                if (column) {
                    column.enabled = true;
                }

                if (category !== undefined && category !== null) {
                    sheet.withCategoryRow = true;
                }
            }
        }
    }

    getFilter(): ExcelWorkbookFilter {
        return ExcelWorkbookFilter.create({
            sheets: this.sheets.flatMap((sheet) => {
                if (!sheet.enabled) {
                    return [];
                }

                return [
                    ExcelSheetFilter.create({
                        id: sheet.id,
                        name: sheet.name,
                        columns: sheet.columns.filter(c => c.enabled).map(c => (ExcelSheetColumnFilter.create({
                            id: c.id,
                            name: c.name,
                            category: sheet.withCategoryRow ? (c.category ?? '') : null, // '' makes sure the backend knows it can add categories for smart categories
                        }))),
                    }),
                ];
            }),
        });
    }
}
