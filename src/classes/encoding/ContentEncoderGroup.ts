import { ContentEncoder } from './ContentEncoder';
import { ContentType } from '../routing/ContentType';

/// Support encoding multiple types (not needed yet)
export class ContentEncoderGroup<T> implements ContentEncoder<T, any> {
    encoders: ContentEncoder<T, any>[]
    constructor(...encoders: ContentEncoder<T, any>[]) {
        this.encoders = encoders
    }

    getContentTypes(): ContentType[] {
        return this.encoders.flatMap(el => el.getContentTypes());
    }

    encodeContent(contentType: ContentType, data: T): any {
        const encoder = this.encoders.find((encoder) => {
            return encoder.getContentTypes().some(type => type.matches(contentType))
        });

        if (!encoder) {
            throw new Error("Unsupported contentType " + contentType);
        }

        return encoder.encodeContent(contentType, data)
    }
}