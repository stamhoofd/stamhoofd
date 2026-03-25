import type { SQLCurrentColumn} from '../SQLFilter.js';
import { SQLValueType } from '../SQLFilter.js';

export function isJSONColumn({ type }: SQLCurrentColumn): boolean {
    return isJSONType(type);
}

export function isJSONType(type: SQLValueType): boolean {
    return type === SQLValueType.JSONString
        || type === SQLValueType.JSONBoolean
        || type === SQLValueType.JSONNumber
        || type === SQLValueType.JSONScalar
        || type === SQLValueType.JSONArray
        || type === SQLValueType.JSONObject;
}
