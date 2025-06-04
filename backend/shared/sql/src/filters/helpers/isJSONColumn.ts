import { SQLCurrentColumn, SQLValueType } from '../SQLModernFilter';

export function isJSONColumn({ type }: SQLCurrentColumn): boolean {
    return type === SQLValueType.JSONString
        || type === SQLValueType.JSONBoolean
        || type === SQLValueType.JSONNumber
        || type === SQLValueType.JSONArray
        || type === SQLValueType.JSONObject;
}
