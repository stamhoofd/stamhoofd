import { XlsxTransformerSheet, XlsxWorkbookFilter } from "./interfaces";
import { SimpleError } from "@simonbackx/simple-errors";

/**
 * Allows to specify which columns to include in the excel file.
 * Takes a filter object that can be built in the frontend
 */
export class XlsxColumnFilterer<T> {
    allSheets: XlsxTransformerSheet<T, unknown>[];

    constructor(allSheets: XlsxTransformerSheet<T, unknown>[]) {
        this.allSheets = allSheets;
    }

    filterColumns(filter: XlsxWorkbookFilter): XlsxTransformerSheet<T, unknown>[] {
        // Validate sheetFilter
        for (const {id} of filter.sheets) {
            if (!this.allSheets.find(sheet => sheet.id === id)) {
                throw new SimpleError({
                    code: "invalid_sheet",
                    message: "Invalid sheet " + id,
                    human: 'Ongeldig werkblad ' + id+', deze wordt niet (meer) ondersteund',
                    statusCode: 400
                });
            }
        }

        const sheets = this.allSheets.flatMap(sheet => {
            const sheetFilter = filter.sheets.find(s => s.id === sheet.id);

            if (!sheetFilter) {
                return [];
            }

            // Validate sheetFilter
            for (const id of sheetFilter.columns) {
                if (!sheet.columns.find(col => col.id === id)) {
                    throw new SimpleError({
                        code: "invalid_column",
                        message: "Invalid column " + id,
                        human: 'Ongeldige kolom ' + id+', deze wordt niet (meer) ondersteund',
                        statusCode: 400
                    });
                }
            }

            const columns = sheet.columns.filter(col => {
                return sheetFilter.columns.includes(col.id);
            })

            if (columns.length === 0) {
                return [];
            }

            return [{
                ...sheet,
                columns
            }];
        });

        if (sheets.length === 0) {
            throw new SimpleError({
                code: "no_columns",
                message: "No columns selected",
                human: 'Geen enkele kolom is geselecteerd',
                statusCode: 400
            });
        }


        return sheets;
    }
}
