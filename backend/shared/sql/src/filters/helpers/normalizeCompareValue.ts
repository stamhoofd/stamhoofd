import { StamhoofdCompareValue } from '@stamhoofd/structures';
import { SQLValueType } from '../SQLFilter.js';

/**
 * Prepares a compare value so we can compare it, given a certain column type.
 *
 * E.g. if you pass in true - and we are comparing against a mysql boolean column, convert it to 1.
 */
export function normalizeCompareValue(val: StamhoofdCompareValue, againstType: SQLValueType): string | number | Date | null | boolean {
    if (againstType === SQLValueType.Table) {
        throw new Error('Cannot compare at root level');
    }

    if (againstType === SQLValueType.JSONObject) {
        if (val === null) {
            return null;
        }
        throw new Error('Cannot compare with a JSON object');
    }

    if (val instanceof Date) {
        if (againstType === SQLValueType.Datetime) {
            return val;
        }
        throw new Error('Cannot compare a date with a non-datetime column');
    }

    if (typeof val === 'string') {
        if (againstType === SQLValueType.String || againstType === SQLValueType.JSONString) {
            return val.toLocaleLowerCase();
        }

        if (againstType === SQLValueType.JSONArray) {
            // We'll search inside the array
            return val.toLocaleLowerCase();
        }

        // Allowed to compare strings with dates
        if (againstType === SQLValueType.Datetime) {
            // Note, taht if you ever filter dates by string values, you need to work with UTC timezones
            return val;
        }

        throw new Error('Cannot compare a string with a non-string column');
    }

    if (typeof val === 'boolean') {
        if (againstType === SQLValueType.JSONBoolean) {
            return val;
        }
        if (againstType === SQLValueType.Boolean || againstType === SQLValueType.Number) {
            return val === true ? 1 : 0;
        }
        if (againstType === SQLValueType.JSONArray) {
            // We'll search inside the array
            return val;
        }
        throw new Error('Cannot compare a boolean with a non-boolean column');
    }

    if (typeof val === 'number') {
        if (againstType === SQLValueType.JSONBoolean) {
            return val === 1 ? true : false;
        }

        if (againstType === SQLValueType.Boolean) {
            if (val !== 1 && val !== 0) {
                throw new Error('Cannot compare a number with a boolean column');
            }
            return val;
        }

        if (againstType === SQLValueType.Number || againstType === SQLValueType.JSONNumber) {
            return val;
        }

        if (againstType === SQLValueType.JSONArray) {
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
