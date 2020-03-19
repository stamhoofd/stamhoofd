
/// Decode unknown data that can be decoded depending on it's content type
export interface ContentDecoder<D, T> {
    getContentTypes(): string[]
    decodeContent(contentType: string, data: D): T
}


