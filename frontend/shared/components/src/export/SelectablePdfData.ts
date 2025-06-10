import { Formatter } from '@stamhoofd/utility';
import { SelectableData } from './SelectableData';

export type SelectablePdfColumnValue = string | null | undefined | number | boolean | Date;

export class SelectablePdfData<T> implements SelectableData {
    enabled: boolean = true;
    id: string;

    name: string;
    description: string = '';
    category?: string | null = null;
    getValue: (object: T) => SelectablePdfColumnValue;

    constructor(data: {
        enabled?: boolean;
        id: string;
        name: string;
        description?: string;
        category?: string | null;
        getValue: (object: T) => SelectablePdfColumnValue;
    }) {
        Object.assign(this, data);
        this.getValue = data.getValue;
    }

    static fromSelectableData<T>(data: SelectableData, getValue: (object: T) => SelectablePdfColumnValue) {
        return new SelectablePdfData({
            ...data,
            getValue,
        });
    }

    getStringValue(item: T) {
        return SelectablePdfData.valueToString(this.getValue(item));
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
