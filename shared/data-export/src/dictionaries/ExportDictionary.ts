import { CellValue, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import {
    PdfTransformerConcreteItem,
    PdfTransformerItem,
} from '@stamhoofd/frontend-excel-export/src/pdf/PdfTransformerItem';
import { ExportItem } from '../types/ExportItem';

export type MatchItemsRecords<X, RecordKeys extends string = string> = Record<
    RecordKeys,
    {
        getMatchedRecordItem: (
            id: string,
        ) => ExportItem<X> & { id: string };
    }
>;

export type MatchItems<T, X, RecordKeys extends string = string> = {
    isMatch(id: string): boolean;
    getMatchedValue(object: T): X;
    records: MatchItemsRecords<X, RecordKeys> | (() => MatchItemsRecords<X, RecordKeys>);
};

type MatchItemRecordKeys<T, Dictionary extends ExportDictionary<T>, ID extends keyof Dictionary['matchDictionary'] & string> = keyof ((Dictionary)['matchDictionary'][ID] extends any[] ? (Dictionary['matchDictionary'][ID][0]['records']) : Dictionary['matchDictionary'][ID] extends MatchItems<T, any> ? (Dictionary['matchDictionary'][ID]['records']) : never);

export abstract class ExportDictionary<T> {
    abstract concreteDictionary: Record<string, ExportItem<T> | { customId: string; value: ExportItem<T> }[]>;
    abstract matchDictionary: Record<string, MatchItems<T, any> | MatchItems<T, any>[]>;

    private getConcreteItem(
        id: keyof (typeof this)['concreteDictionary'] & string,
    ): ExportItem<T> | { customId: string; value: ExportItem<T> }[] {
        return this.concreteDictionary[id];
    }

    private getMatchItem<
        ID extends keyof (typeof this)['matchDictionary'] & string,
        R>(id: ID): MatchItems<T, R> | MatchItems<T, R>[] {
        return this.matchDictionary[id];
    }

    private extendConcreteItem<
        X extends { getValue: (object: T) => any } & Omit<
            ExportItem<T>,
            'getValue'
        >,
    >(
        id: keyof (typeof this)['concreteDictionary'] & string,
        extend: (customId: string) => Omit<X, keyof ExportItem<T>> & {
            getValue: (object: T) => Omit<ReturnType<X['getValue']>, 'value'>;
        },
    ): X[] {
        const item = this.getConcreteItem(id);

        return (Array.isArray(item) ? item : [{ value: item, customId: id }]).map((x) => {
            const exportItem = x.value;
            const extended = extend(x.customId);

            return {
                ...extended,
                ...exportItem,
                getValue: (x: T) => {
                    return {
                        value: exportItem.getValue(x),
                        ...extended.getValue(x),
                    };
                },
            } as X;
        });
    }

    private extendMatchItem<
        ID extends keyof (typeof this)['matchDictionary'] & string,
        X extends { getValue: (object: T) => any; id: string } & Omit<
            ExportItem<T>,
            'getValue'
        >,
    >(
        id: keyof (typeof this)['matchDictionary'] & string,
        extensions:
            Record<
                MatchItemRecordKeys<T, typeof this, ID>,
                Omit<X, keyof ExportItem<T> | 'id'> & {
                    getValue: (
                        object: T,
                    ) => Omit<ReturnType<X['getValue']>, 'value'>;
                }
            >,
    ): ((id: string) => X[] | undefined)[] {
        const matchItem = this.getMatchItem(id);

        const entries = Object.entries(extensions);

        if (entries.length === 0) {
            return [];
        }

        return (Array.isArray(matchItem) ? matchItem : [matchItem]).flatMap((x) => {
            return (id: string): X[] | undefined => {
                if (!x.isMatch(id)) {
                    return undefined;
                }

                return entries.flatMap(([id, extend]) => {
                    if (!extend) {
                        return [];
                    }
                    const record = x.records[id];
                    if (!record) {
                        return [];
                    }

                    const matchedRecordItem = record.getMatchedRecordItem(id);

                    const exportItem: ExportItem<T> & { id: string } = {
                        ...matchedRecordItem,
                        getValue: (item: T) =>
                            matchedRecordItem.getValue(
                                x.getMatchedValue(item),
                            ),
                    };

                    const merged: X = {
                        ...exportItem,
                        ...extend,
                        getValue: (x: T) => {
                            const value = exportItem.getValue(x);
                            return {
                                value,
                                ...extend.getValue(x),
                            };
                        },
                    } as X;

                    return [merged];
                });
            };
        });
    }

    defineMatchPdfItem<
        ID extends keyof (typeof this)['matchDictionary'] & string,
    >(
        id: ID,
        extensions:
            Record<
                MatchItemRecordKeys<T, typeof this, ID>,
                Omit<PdfTransformerConcreteItem<T>, keyof ExportItem<T> | 'id'>

            >,
    ): ((id: string) => PdfTransformerConcreteItem<T>[] | undefined)[] {
        const transformedEntries = Object.entries(extensions).map(
            ([id, extend]) => {
                return [
                    id,
                    {
                        ...extend,
                        getValue: () => ({}),
                    },
                ];
            },
        );

        const transformedExtensions:
        Record<
            MatchItemRecordKeys<T, typeof this, ID>,
            Omit<PdfTransformerConcreteItem<T>, keyof ExportItem<T> | 'id'> & {
                getValue: (
                    object: T,
                ) => Omit<ReturnType<PdfTransformerConcreteItem<T>['getValue']>, 'value'>;
            }
        >
         = Object.fromEntries(transformedEntries);

        return this.extendMatchItem<ID, PdfTransformerConcreteItem<T>>(
            id,
            transformedExtensions,
        );
    }

    defineConcretePdfItem<
        ID extends keyof DICT['concreteDictionary'] & string,
        DICT extends ExportDictionary<T> = typeof this,
    >(
        id: ID,
        extend: Omit<
            PdfTransformerConcreteItem<T>,
            keyof ExportItem<T> | 'id'
        > = {},
    ): PdfTransformerConcreteItem<T>[] {
        return this.extendConcreteItem<PdfTransformerConcreteItem<T>>(id, (customId: string) => ({
            id: customId,
            ...extend,
            getValue: () => ({}),
        }));
    }

    defineConcretePdfItems(
        record: Partial<
            Record<
                keyof (typeof this)['concreteDictionary'] & string,
                Omit<PdfTransformerConcreteItem<T>, keyof ExportItem<T> | 'id'>
            >
        >,
    ): PdfTransformerItem<T>[] {
        return Object.entries(record).flatMap(([id, extend]) => {
            if (!extend) {
                return [];
            }

            return this.defineConcretePdfItem(id, extend);
        });
    }

    defineConcreteExcelColumn<
        ID extends keyof DICT['concreteDictionary'] & string,
        DICT extends ExportDictionary<T> = typeof this,
    >(
        id: ID,
        extend: Omit<
            XlsxTransformerConcreteColumn<T>,
            keyof ExportItem<T> | 'id'
        > & {
            getValue: (
                object: T,
            ) => Omit<
                ReturnType<XlsxTransformerConcreteColumn<T>['getValue']>,
                'value'
            >;
        },
    ): XlsxTransformerConcreteColumn<T>[] {
        return this.extendConcreteItem<XlsxTransformerConcreteColumn<T>>(id, (customId: string) => ({
            id: customId,
            ...extend,
            getValue: (t) => {
                return extend.getValue(t);
            },
        }));
    }

    defineConcreteExcelColumns<Dictionary extends ExportDictionary<T>>(
        record: Partial<
            Record<
                keyof Dictionary['concreteDictionary'] & string,
                Omit<
                    XlsxTransformerConcreteColumn<T>,
                    keyof ExportItem<T> | 'id'
                > & {
                    getValue?: (
                        object: T,
                    ) => Omit<
                        CellValue,
                        'value'
                    >;
                }
            >
        >,
    ): XlsxTransformerConcreteColumn<T>[] {
        return Object.entries(record).flatMap(([id, extend]) => {
            if (!extend) {
                return [];
            }

            if (!extend.getValue) {
                extend.getValue = () => ({});
            }

            const extendWithGetValue = extend.getValue === undefined
                ? {
                        ...extend,
                        getValue: () => ({}),
                    }
                : extend as Omit<
                    XlsxTransformerConcreteColumn<T>,
                    keyof ExportItem<T> | 'id'
                > & {
                    getValue: (
                        object: T,
                    ) => Omit<
                        CellValue,
                        'value'
                    >;
                };

            return this.defineConcreteExcelColumn(id, extendWithGetValue);
        });
    }

    defineMatchExcelColumn<
        Dictionary extends ExportDictionary<T>,
        ID extends keyof (typeof this)['matchDictionary'] & string,
    >(
        id: keyof Dictionary['matchDictionary'] & string,
        extensions:
            Record<
                MatchItemRecordKeys<T, Dictionary, ID>,
                Omit<XlsxTransformerConcreteColumn<T>, keyof ExportItem<T> | 'id'> & {
                    getValue?: (
                        object: T,
                    ) => Omit<ReturnType<XlsxTransformerConcreteColumn<T>['getValue']>, 'value'>;
                }

            >,
    ): ({ match: (id: string) => XlsxTransformerConcreteColumn<T>[] | undefined })[] {
        const transformedEntries = Object.entries(extensions).map(
            ([id, extend]) => {
                const extendWithGetValue = extend.getValue === undefined
                    ? {
                            ...extend,
                            getValue: () => ({}),
                        }
                    : extend as Omit<
                        XlsxTransformerConcreteColumn<T>,
                    keyof ExportItem<T> | 'id'
                    > & {
                        getValue: (
                            object: T,
                        ) => Omit<
                            CellValue,
                            'value'
                        >;
                    };

                return [
                    id,
                    extendWithGetValue,
                ];
            },
        );

        const transformedExtensions: Record<
            MatchItemRecordKeys<T, Dictionary, ID>,
            Omit<XlsxTransformerConcreteColumn<T>, keyof ExportItem<T> | 'id'> & {
                getValue: (
                    object: T,
                ) => Omit<ReturnType<XlsxTransformerConcreteColumn<T>['getValue']>, 'value'>;
            }

        > = Object.fromEntries(transformedEntries);

        return this.extendMatchItem<ID, XlsxTransformerConcreteColumn<T>>(id, transformedExtensions).map(x => ({ match: x }));
    }

    defineMatchExcelColumns<Dictionary extends ExportDictionary<T>>(
        record: Partial<
            Record<
                keyof Dictionary['matchDictionary'] & string,
                Record<
                    MatchItemRecordKeys<T, Dictionary, keyof Dictionary['matchDictionary'] & string>,
                    Omit<XlsxTransformerConcreteColumn<T>, keyof ExportItem<T> | 'id'> & {
                        getValue: (
                            object: T,
                        ) => Omit<ReturnType<XlsxTransformerConcreteColumn<T>['getValue']>, 'value'>;
                    }
                >
            >
        >,
    ): ({ match: (id: string) => XlsxTransformerConcreteColumn<T>[] | undefined })[] {
        return Object.entries(record).flatMap(([id, extensions]) => this.defineMatchExcelColumn(id, extensions as Record<
            MatchItemRecordKeys<T, Dictionary, keyof Dictionary['matchDictionary'] & string>,
            Omit<XlsxTransformerConcreteColumn<T>, keyof ExportItem<T>> & {
                getValue: (
                    object: T,
                ) => Omit<ReturnType<XlsxTransformerConcreteColumn<T>['getValue']>, 'value'>;
            }
        >));
    }
}
