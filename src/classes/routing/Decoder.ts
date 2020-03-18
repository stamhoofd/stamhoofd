/// Decode unknown data that can be decoded depending on it's content type
export interface ContentDecoder<D, T> {
    getContentTypes(): string[]
    decodeContent(contentType: string, data: D): T
}

/// Decode data that is structured in maps and arrays
export interface Data {
    readonly string: string;
    readonly number: number;
    field(field: string): Data;
}

/// Implementation of Data that reads an already existing tree of data. 
export class ObjectData implements Data {
    data: any

    constructor(data: any) {
        this.data = data
    }

    get string(): string {
        // todo: throw
        return this.data as string
    }

    get number(): number {
        // todo: throw
        return this.data as number
    }

    field(field: string): Data {
        // todo: throw
        return new ObjectData((this.data as any)[field])
    }
}

export class EmptyDecoder /* static implements ContentDecoder<object, {}> */ {
    static getContentTypes(): string[] {
        return [""]
    }

    static decodeContent(contentType: string, data: object): {} {
        if (Object.keys(data).length === 0 && data.constructor === Object) {
            return {};
        }
        throw new Error("Expected an empty object");
    }
}

export class JSONContentDecoder<T> implements ContentDecoder<any, T> {
    decoders: ContentDecoder<Data, T>[]
    constructor(...decoders: ContentDecoder<Data, T>[]) {
        this.decoders = decoders
    }

    getContentTypes(): string[] {
        return this.decoders.flatMap(el => el.getContentTypes());
    }

    decodeContent(contentType: string, data: any): T {
        const decoder = this.decoders.find((decoder) => {
            return decoder.getContentTypes().includes(contentType)
        });
        if (!decoder) {
            throw new Error("Could not decode JSON to contentType " + contentType);
        }

        // todo: implement
        var d = new ObjectData(JSON.parse(data));
        return decoder.decodeContent(contentType, d)
    }
}