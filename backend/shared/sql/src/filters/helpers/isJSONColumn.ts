import type { SQLCurrentColumn } from '../SQLFilterTypes.js';
import { SQLValueType } from '../SQLFilterTypes.js';

export function isJSONColumn({ type }: SQLCurrentColumn): boolean {
    return isJSONType(type);
}

export function isJSONType(type: SQLValueType): boolean {
    return type === SQLValueType.JSONString
        || type === SQLValueType.JSONBoolean
        || type === SQLValueType.JSONNumber
        || type === SQLValueType.JSONDate
        || type === SQLValueType.JSONScalar
        || type === SQLValueType.JSONArray
        || type === SQLValueType.JSONObject;
}
