import { ContentType } from '../routing/ContentType';

/// Encode type A to type T, that implements Encodeable or is any
export interface ContentEncoder<T, D> {
    getContentTypes(): ContentType[]
    encodeContent(contentType: ContentType, data: T): D
}