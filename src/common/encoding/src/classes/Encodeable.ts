export interface Encodeable {
    encode(): any;
}

export function isEncodeable(object: any): object is Encodeable {
    return object.encode
}