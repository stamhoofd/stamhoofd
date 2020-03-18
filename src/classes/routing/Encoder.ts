/// Encode type A to type T, that implements Encodeable or is any
export interface ContentEncoder<T, D> {
    getContentTypes(): string[]
    encodeContent(contentType: string, data: T): D
}

/// Support encoding multiple types (not needed yet)
export class ContentEncoderGroup<T> implements ContentEncoder<T, any> {
    encoders: ContentEncoder<T, any>[]
    constructor(...encoders: ContentEncoder<T, any>[]) {
        this.encoders = encoders
    }

    getContentTypes(): string[] {
        return this.encoders.flatMap(el => el.getContentTypes());
    }

    encodeContent(contentType: string, data: T): any {
        const encoder = this.encoders.find((encoder) => {
            return encoder.getContentTypes().includes(contentType)
        });

        if (!encoder) {
            throw new Error("Unsupported contentType " + contentType);
        }

        return encoder.encodeContent(contentType, data)
    }
}

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