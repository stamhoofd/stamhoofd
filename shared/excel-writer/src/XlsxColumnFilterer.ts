import { XlsxTransformerConcreteColumn, XlsxTransformerConcreteSheet, XlsxTransformerSheet, XlsxWorkbookFilter } from './interfaces';
import { SimpleError } from '@simonbackx/simple-errors';

/**
 * Allows to specify which columns to include in the excel file.
 * Takes a filter object that can be built in the frontend
 */
export class XlsxColumnFilterer<T> {
    allSheets: XlsxTransformerSheet<T, unknown>[];

    constructor(allSheets: XlsxTransformerSheet<T, unknown>[]) {
        this.allSheets = allSheets;
    }

    filterColumns(filter: XlsxWorkbookFilter): XlsxTransformerConcreteSheet<T, unknown>[] {
        // Validate sheetFilter
        for (const { id } of filter.sheets) {
            if (!this.allSheets.find(sheet => sheet.id === id)) {
                throw new SimpleError({
                    code: 'invalid_sheet',
                    message: 'Invalid sheet ' + id,
                    human: 'Ongeldig werkblad ' + id + ', deze wordt niet (meer) ondersteund',
                    statusCode: 400,
                });
            }
        }

        const sheets = this.allSheets.flatMap((sheet) => {
            const sheetFilter = filter.sheets.find(s => s.id === sheet.id);

            if (!sheetFilter) {
                return [];
            }

            // Validate sheetFilter
            const concreteColumns: XlsxTransformerConcreteColumn<T>[] = [];
            for (const { id, name } of sheetFilter.columns) {
                let found = false;

                for (const column of sheet.columns) {
                    if ('id' in column) {
                        if (column.id === id) {
                            const c = { ...column };
                            c.name = name || c.name;
                            concreteColumns.push(c);
                            found = true;
                            break;
                        }
                    }
                    else {
                        const matched = column.match(id);
                        if (matched !== undefined) {
                            if (name) {
                                for (const m of matched) {
                                    if (matched.length === 1) {
                                        m.name = name || m.name;
                                    }
                                    else {
                                        m.name = name + ' ' + m.name;
                                    }
                                }
                            }
                            concreteColumns.push(...matched);
                            found = true;
                            break;
                        }
                    }
                }

                if (!found) {
                    throw new SimpleError({
                        code: 'invalid_column',
                        message: 'Invalid column ' + id,
                        human: 'Ongeldige kolom ' + id + ', deze wordt niet (meer) ondersteund',
                        statusCode: 400,
                    });
                }
            }
            if (concreteColumns.length === 0) {
                return [];
            }

            return [{
                ...sheet,
                columns: concreteColumns,
            }];
        });

        if (sheets.length === 0) {
            throw new SimpleError({
                code: 'no_columns',
                message: 'No columns selected',
                human: 'Geen enkele kolom is geselecteerd',
                statusCode: 400,
            });
        }

        return sheets;
    }
}
