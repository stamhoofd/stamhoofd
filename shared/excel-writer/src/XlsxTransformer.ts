import { XlsxTransformerConcreteColumn, XlsxTransformerConcreteSheet, XlsxTransformerSheet, XlsxWriterAdapter } from './interfaces.js';

/**
 * Transforms data into an excel file using
 * a writer that can write to an excel file
 */
export class XlsxTransformer<T> {
    sheets: XlsxTransformerConcreteSheet<T, unknown>[];
    writer: XlsxWriterAdapter;
    sheetMap: Map<XlsxTransformerSheet<T, unknown>, symbol> = new Map();

    constructor(sheets: XlsxTransformerConcreteSheet<T, unknown>[], writer: XlsxWriterAdapter) {
        this.sheets = sheets;
        this.writer = writer;
    }

    async init() {
        for (const sheet of this.sheets) {
            let sheetSymbol = this.sheetMap.get(sheet);
            if (!sheetSymbol) {
                sheetSymbol = await this.writer.addSheet(sheet.name);
                this.sheetMap.set(sheet, sheetSymbol);
            }
        }
        await this.writer.ready();

        // Write column headers
        for (const sheet of this.sheets) {
            const sheetSymbol = this.sheetMap.get(sheet);
            if (!sheetSymbol) {
                throw new Error('Sheet not found');
            }

            const hasColumns = sheet.columns.find(col => !!col.category);
            if (hasColumns) {
                const categories: {
                    name: string;
                    columns: XlsxTransformerConcreteColumn<unknown>[];
                }[] = [];

                for (const col of sheet.columns) {
                    const lastCategory = categories[categories.length - 1];
                    if (lastCategory && lastCategory.name === (col.category ?? '')) {
                        lastCategory.columns.push(col);
                    }
                    else {
                        // Create new category
                        categories.push({
                            name: col.category ?? '',
                            columns: [col],
                        });
                    }
                }

                // Write in bold
                await this.writer.addRow(sheetSymbol, categories.flatMap((col) => {
                    return col.columns.map((c, index) => {
                        if (index === 0) {
                            return {
                                value: col.name,
                                width: c.width,
                                style: {
                                    font: {
                                        bold: true,
                                    },
                                },
                                merge: {
                                    width: col.columns.length,
                                    height: 1,
                                },
                            };
                        }
                        return {
                            value: null,
                            width: c.width,
                            style: {
                                font: {
                                    bold: true,
                                },
                            },
                        };
                    });
                }));
            }

            await this.writer.addRow(sheetSymbol, sheet.columns.map((col) => {
                return {
                    value: col.name,
                    width: col.width,
                    style: {
                        font: {
                            bold: true,
                        },
                    },
                };
            }));
        }
    }

    async process(data: T[]) {
        for (const sheet of this.sheets) {
            const sheetSymbol = this.sheetMap.get(sheet);
            if (!sheetSymbol) {
                throw new Error('Sheet not found');
            }

            for (const item of data) {
                for (const transformedItem of sheet.transform ? sheet.transform(item) : [item]) {
                    await this.writer.addRow(sheetSymbol, sheet.columns.map(col => col.getValue(transformedItem)));
                }
            }
        }
    }
}
