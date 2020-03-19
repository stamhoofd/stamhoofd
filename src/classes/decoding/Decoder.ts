/// Decode unknown data that can be decoded depending on it's content type
export interface Decoder<T> {
    decode(data: any): T
}