import type { SelectableXlsxTransformerColumn } from '#SelectableXlsxTransformerColumn.ts';
import type { XlsxTransformerColumn } from '@stamhoofd/excel-writer/core';

export function toTransformerColumn<R>(selectableColumn: SelectableXlsxTransformerColumn<R>): XlsxTransformerColumn<R> {
    if (selectableColumn.columns.length === 1 && selectableColumn.columns[0].id === selectableColumn.id) {
        return selectableColumn.columns[0];
    }

    // A group that expands to multiple Excel columns (e.g. address records): match on the group id
    return {
        match: (id: string) => id === selectableColumn.id ? selectableColumn.columns.map(column => ({ ...column })) : undefined,
    };
}
