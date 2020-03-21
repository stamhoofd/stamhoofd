import { Data } from './Data'
import { Decoder } from './Decoder'
import { ContentDecoder } from './ContentDecoder'
import { ArrayDecoder } from './ArrayDecoder'
import { ContentType } from '../routing/ContentType'

/// Implementation of Data that reads an already existing tree of data. 
export class ObjectData implements Data {
    data: any

    constructor(data: any) {
        this.data = data
    }

    get value(): any {
        return this.data
    }

    get string(): string {
        // todo: throw
        return this.data as string
    }

    get number(): number {
        // todo: throw
        return this.data as number
    }

    get array(): Data[] {
        return (this.value as any[]).map(v => new ObjectData(v))
    }

    index(number: number): Data {
        // todo: throw
        return new ObjectData((this.data as any)[number])
    }

    field(field: string): Data {
        if (this.data && this.data[field]) {
            return new ObjectData((this.data as any)[field])
        }
        throw new Error(`Field ${field} expected`);
    }

    decode<T>(decoder: Decoder<T>): T {
        // tmp hack for arrays
        if (decoder instanceof ArrayDecoder) {
            return decoder.decode(this);
        }
        return decoder.decode(this.data);
    }

    decodeContent<T>(contentType: ContentType, decoder: ContentDecoder<Data, T>): T {
        return decoder.decodeContent(contentType, this);
    }
}
