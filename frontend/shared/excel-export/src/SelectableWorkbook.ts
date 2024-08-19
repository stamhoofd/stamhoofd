import { ExcelWorkbookFilter, ExcelSheetFilter } from "@stamhoofd/structures";
import { SelectableSheet } from "./SelectableSheet";

export class SelectableWorkbook {
    sheets: SelectableSheet[] = [];

    constructor(data: {sheets: SelectableSheet[]}) {
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
            const sheet = this.sheets.find(sheet => sheet.id == s.id);
            if (!sheet) {
                continue;
            }

            for (const id of s.columns) {
                const column = sheet.columns.find(c => c.id == id);
                if (column) {
                    column.enabled = true;
                }
            }
        }
    }

    getFilter(): ExcelWorkbookFilter {
        return ExcelWorkbookFilter.create({
            sheets: this.sheets.flatMap(sheet => {
                if (!sheet.enabled) {
                    return [];
                }

                return [
                    ExcelSheetFilter.create({
                        id: sheet.id,
                        columns: sheet.columns.filter(c => c.enabled).map(c => c.id)
                    })
                ]
            })
        })
    }
}
