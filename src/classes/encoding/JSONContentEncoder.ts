import { ContentEncoder } from './ContentEncoder';
import { ContentType } from '../routing/ContentType';

export class JSONContentEncoder<T> implements ContentEncoder<T, string>{
    encoder: ContentEncoder<T, any>
    constructor(encoder: ContentEncoder<T, any>) {
        this.encoder = encoder
    }

    getContentTypes(): ContentType[] {
        return this.encoder.getContentTypes();
    }

    encodeContent(contentType: ContentType, data: T): string {
        if (contentType.suffix != "json" && contentType.name != "application/json") {
            throw new Error("Expected JSON");
        }

        if (process.env.NODE_ENV == "development") {
            return JSON.stringify(this.encoder.encodeContent(contentType, data), null, 4);
        }
        return JSON.stringify(this.encoder.encodeContent(contentType, data))
    }
}