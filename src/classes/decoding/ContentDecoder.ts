import { ContentType } from '../routing/ContentType';

/// Decode unknown data that can be decoded depending on it's content type
export interface ContentDecoder<D, T> {
    getContentTypes(): ContentType[];
    decodeContent(contentType: ContentType, data: D): T;
}


