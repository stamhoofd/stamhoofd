import { StamhoofdCompareValue } from '@stamhoofd/structures';
import { SQLModernValueType } from '../SQLModernFilter';

/**
 * Prepares a compare value so we can compare it, given a certain column type.
 *
 * E.g. if you pass in true - and we are comparing against a mysql boolean column, convert it to 1.
 */
export function normalizeCompareValue(val: StamhoofdCompareValue, againstType: SQLModernValueType): string | number | Date | null | boolean {
    if (againstType === SQLModernValueType.Table) {
        throw new Error('Cannot compare at root level');
    }

    if (againstType === SQLModernValueType.JSONObject) {
        if (val === null) {
            return null;
        }
        throw new Error('Cannot compare with a JSON object');
    }

    if (val instanceof Date) {
        if (againstType === SQLModernValueType.Datetime) {
            return val;
        }
        throw new Error('Cannot compare a date with a non-datetime column');
    }

    if (typeof val === 'string') {
        if (againstType === SQLModernValueType.String || againstType === SQLModernValueType.JSONString) {
            return val.toLocaleLowerCase();
        }

        if (againstType === SQLModernValueType.JSONArray) {
            // We'll search inside the array
            return val.toLocaleLowerCase();
        }

        throw new Error('Cannot compare a string with a non-string column');
    }

    if (typeof val === 'boolean') {
        if (againstType === SQLModernValueType.JSONBoolean) {
            return val;
        }
        if (againstType === SQLModernValueType.Boolean || againstType === SQLModernValueType.Number) {
            return val === true ? 1 : 0;
        }
        if (againstType === SQLModernValueType.JSONArray) {
            // We'll search inside the array
            return val;
        }
        throw new Error('Cannot compare a boolean with a non-boolean column');
    }

    if (typeof val === 'number') {
        if (againstType === SQLModernValueType.JSONBoolean) {
            return val === 1 ? true : false;
        }

        if (againstType === SQLModernValueType.Boolean) {
            if (val !== 1 && val !== 0) {
                throw new Error('Cannot compare a number with a boolean column');
            }
            return val;
        }

        if (againstType === SQLModernValueType.Number || againstType === SQLModernValueType.JSONNumber) {
            return val;
        }

        if (againstType === SQLModernValueType.JSONArray) {
            // We'll search inside the array
            return val;
        }

        throw new Error('Cannot compare a number with a non-number column');
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && '$' in val) {
        const specialValue = val['$'];

        switch (specialValue) {
            case '$now':
                return normalizeCompareValue(new Date(), againstType);
            default:
                throw new Error('Unsupported magic value ' + specialValue);
        }
    }

    return val;
}
