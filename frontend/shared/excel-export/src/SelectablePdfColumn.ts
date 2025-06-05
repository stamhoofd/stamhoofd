import { Formatter } from '@stamhoofd/utility';
import { SelectableColumn } from './SelectableColumn';

export type SelectablePdfColumnValue = string | null | undefined | number | boolean | Date;

export class SelectablePdfColumn<T> extends SelectableColumn {
    getValue: (object: T) => SelectablePdfColumnValue;

    constructor(data: {
        enabled?: boolean;
        id: string;
        name: string;
        description?: string;
        category?: string | null;
        getValue: (object: T) => SelectablePdfColumnValue;
    }) {
        super(data);
        this.getValue = data.getValue;
    }

    static fromSelectableColumn<T>(selectableColumn: SelectableColumn, getValue: (object: T) => SelectablePdfColumnValue) {
        return new SelectablePdfColumn({
            ...selectableColumn,
            getValue,
        });
    }

    getStringValue(item: T) {
        return SelectablePdfColumn.valueToString(this.getValue(item));
    }

    static valueToString(value: SelectablePdfColumnValue): string {
        if (value === null || value === undefined) {
            return '';
        }

        switch (typeof value) {
            case 'string':
                return value;
            case 'number':
                return value.toString();
            case 'boolean':
                return value ? $t('ja') : $t('nee');
            case 'object': {
                if (value instanceof Date) {
                    return Formatter.date(value);
                }
                return '';
            }
            default:
                return '';
        }
    }
}
