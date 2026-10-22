import type { StamhoofdCompareValue } from '@stamhoofd/filters/StamhoofdFilterTypes';
import { SQLJsonValue } from '../../SQLJsonExpressions.js';
import type { SQLCurrentColumn } from '../SQLFilterTypes.js';
import { SQLValueType } from '../SQLFilterTypes.js';

/**
 * Casts json strings, numbers and booleans to native MySQL types. This includes json null to mysql null.
 */
export function normalizeColumn(column: SQLCurrentColumn, hint?: StamhoofdCompareValue): SQLCurrentColumn {
    if (column.type === SQLValueType.JSONString || (column.type === SQLValueType.JSONScalar && typeof hint === 'string')) {
        return {
            expression: new SQLJsonValue(column.expression, 'CHAR'),
            type: SQLValueType.String,
            nullable: column.nullable,
        };
    }

    if (column.type === SQLValueType.JSONNumber || (column.type === SQLValueType.JSONScalar && typeof hint === 'number')) {
        return {
            expression: new SQLJsonValue(column.expression, 'SIGNED'),
            type: SQLValueType.Number,
            nullable: column.nullable,
        };
    }

    if (column.type === SQLValueType.JSONDate) {
        return {
            expression: new SQLJsonValue(column.expression, 'SIGNED'),
            type: SQLValueType.DateNumber,
            nullable: column.nullable,
        };
    }

    if (column.type === SQLValueType.JSONBoolean || (column.type === SQLValueType.JSONScalar && typeof hint === 'boolean')) {
        return {
            expression: new SQLJsonValue(column.expression, 'UNSIGNED'),
            type: SQLValueType.Boolean,
            nullable: column.nullable,
        };
    }

    return column;
}
