/** JSON-compatible metadata carried by an error. */
export type ErrorValue = string | number | boolean | null | undefined | ErrorValue[] | { [key: string]: ErrorValue };

/** The decoding operations errors need, independent of the encoding implementation. */
export interface ErrorData {
    readonly string: string;
    readonly value: any;
    field(name: string): ErrorData;
    optionalField(name: string): ErrorData | undefined;
    array<T>(decoder: { decode(data: ErrorData): T }): T[];
}
