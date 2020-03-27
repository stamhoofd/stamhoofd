import { Data } from './Data'
import { Decoder } from './Decoder'

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
        return new ObjectData((this.data)[number])
    }

    field(field: string): Data {
        if (this.data && this.data[field]) {
            return new ObjectData((this.data)[field])
        }
        throw new Error(`Field ${field} expected`);
    }

    decode<T>(decoder: Decoder<T>): T {
        return decoder.decode(this);
    }
}
