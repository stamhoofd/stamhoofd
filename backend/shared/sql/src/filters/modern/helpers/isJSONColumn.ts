import { SQLCurrentColumn, SQLModernValueType } from '../SQLModernFilter';

export function isJSONColumn({ type }: SQLCurrentColumn): boolean {
    return isJSONType(type);
}

export function isJSONType(type: SQLModernValueType): boolean {
    return type === SQLModernValueType.JSONString
        || type === SQLModernValueType.JSONBoolean
        || type === SQLModernValueType.JSONNumber
        || type === SQLModernValueType.JSONArray
        || type === SQLModernValueType.JSONObject;
}
