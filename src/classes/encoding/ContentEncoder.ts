/// Encode type A to type T, that implements Encodeable or is any
export interface ContentEncoder<T, D> {
    getContentTypes(): string[]
    encodeContent(contentType: string, data: T): D
}