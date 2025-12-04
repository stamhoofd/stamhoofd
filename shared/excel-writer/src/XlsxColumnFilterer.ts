import { SimpleError } from '@simonbackx/simple-errors';
import { XlsxTransformerConcreteColumn, XlsxTransformerConcreteSheet, XlsxTransformerSheet, XlsxWorkbookFilter } from './interfaces.js';

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
                    human: $t(`ece8f68a-bde5-4734-b1bd-284b1d1df005`, { sheet: id }),
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
            for (const { id, name, category } of sheetFilter.columns) {
                let found = false;

                for (const column of sheet.columns) {
                    if ('id' in column) {
                        if (column.id === id) {
                            const c = { ...column };
                            c.name = name || c.name;
                            c.category = (category !== undefined ? category : c.category) ?? undefined;
                            concreteColumns.push(c);
                            found = true;
                            break;
                        }
                    }
                    else {
                        const matched = column.match(id);
                        if (matched !== undefined) {
                            if (category !== undefined) {
                                for (const m of matched) {
                                    m.category = category ?? undefined;
                                }
                            }

                            if (name) {
                                for (const m of matched) {
                                    if (matched.length === 1) {
                                        m.name = name || m.name;
                                    }
                                    else {
                                        if (!m.name) {
                                            m.name = name || m.name;
                                        }
                                        else {
                                            if (m.name === name) {
                                                // ignore
                                                continue;
                                            }

                                            if (m.category === null || m.category === undefined) {
                                                if (name === m.defaultCategory) {
                                                    // No real added value of repating this if we can't add it cleanly
                                                    continue;
                                                }

                                                // Never create a category if it was not set
                                                m.name = name + ' ' + m.name;
                                            }
                                            else {
                                                if (m.category.trim().length > 0) {
                                                    if (name === m.defaultCategory) {
                                                        // No real added value of repating this if we can't add it cleanly
                                                        continue;
                                                    }
                                                    m.category = m.category.trim() + (' → ' + name);
                                                }
                                                else {
                                                    m.category = name;
                                                }
                                                m.name = m.name ?? '';
                                            }
                                        }
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
                        human: $t(`b99c5cca-eb86-4d02-96db-fcd3c52fc96c`, { column: id }),
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
                human: $t(`54edac94-5527-4d6e-89e8-525503159287`),
                statusCode: 400,
            });
        }

        return sheets;
    }
}
