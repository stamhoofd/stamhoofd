import { ContentEncoder } from './ContentEncoder';

export class JSONContentEncoder<T> implements ContentEncoder<T, string>{
    encoder: ContentEncoder<T, any>
    constructor(encoder: ContentEncoder<T, any>) {
        this.encoder = encoder
    }

    getContentTypes(): string[] {
        return this.encoder.getContentTypes();
    }

    encodeContent(contentType: string, data: T): string {
        return JSON.stringify(this.encoder.encodeContent(contentType, data))
    }
}