import { Formatter } from '@stamhoofd/utility';
import { SelectableData } from './SelectableData';

export type SelectablePdfDataValue = string | null | undefined | number | boolean | Date;

export class SelectablePdfData<T> implements SelectableData {
    enabled: boolean = true;
    id: string;

    name: string;
    description: string = '';
    category?: string | null = null;
    getValue: (object: T) => SelectablePdfDataValue;

    constructor(data: {
        enabled?: boolean;
        id: string;
        name: string;
        description?: string;
        category?: string | null;
        getValue: (object: T) => SelectablePdfDataValue;
    }) {
        Object.assign(this, data);
        this.getValue = data.getValue;
    }

    static fromSelectableData<T>(data: SelectableData, getValue: (object: T) => SelectablePdfDataValue) {
        return new SelectablePdfData({
            ...data,
            getValue,
        });
    }

    getStringValue(item: T) {
        return SelectablePdfData.valueToString(this.getValue(item));
    }

    getStringValueOrNull(item: T) {
        return SelectablePdfData.valueToStringOrNull(this.getValue(item));
    }

    static valueToStringOrNull(value: SelectablePdfDataValue): string | null {
        if (value === null || value === undefined) {
            return null;
        }

        switch (typeof value) {
            case 'string':
                return value;
            case 'number':
                return value.toString();
            case 'boolean':
                return value ? $t('4f68e4bc-4432-4655-b20e-84e6550eda48') : $t('b21855f6-2e9f-4b57-bfe8-05dc38fc330d');
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

    static valueToString(value: SelectablePdfDataValue): string {
        const valueOrNull = this.valueToStringOrNull(value);
        if (valueOrNull === null) {
            return '';
        }

        return valueOrNull;
    }
}
