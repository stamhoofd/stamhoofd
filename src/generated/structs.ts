/* eslint-disable */
import { Data } from '../classes/decoding/Data';
import { StringDecoder } from '../classes/decoding/StringDecoder';
import { ArrayDecoder } from '../classes/decoding/ArrayDecoder';
import { ContentType } from '../classes/routing/ContentType';
/* generated content inserted here */
export class Record /* static implements ContentEncoder<Record, any>, ContentDecoder<Data, Record> */{
    name: string

    static getContentTypes(): ContentType[] {
        return [ContentType.fromString("application/vnd.stamhoofd.Record")];
    }

    static decode(data: Data): Record {
        const d = new Record();
        d.name = data.field("name").decode(StringDecoder);
        return d;
    }

    static decodeContent(contentType: ContentType, data: Data): Record {
        return Record.decode(data);
    }

    static encodeContent(contentType: ContentType, data: Record): any {
        return this;
    }
}

export namespace Member {
    export class Version1 /* static implements ContentEncoder<Version1, any>, ContentDecoder<Data, Version1> */{
        name: string
        records: Record[]
    
        static getContentTypes(): ContentType[] {
            return [ContentType.fromString("application/vnd.stamhoofd.Member;version=1")];
        }
    
        static decode(data: Data): Version1 {
            const d = new Version1();
            d.name = data.field("name").decode(StringDecoder);
            d.records = data.field("records").decode(new ArrayDecoder(Record));
            return d;
        }
    
        static decodeContent(contentType: ContentType, data: Data): Version1 {
            return Version1.decode(data);
        }
    
        static encodeContent(contentType: ContentType, data: Version1): any {
            return this;
        }
    }
    
    export class Version2 /* static implements ContentEncoder<Version2, any>, ContentDecoder<Data, Version2> */{
        records: Record[]
        firstName: string
        lastName: string
    
        static getContentTypes(): ContentType[] {
            return [ContentType.fromString("application/vnd.stamhoofd.Member;version=2")];
        }
    
        static decode(data: Data): Version2 {
            const d = new Version2();
            d.records = data.field("records").decode(new ArrayDecoder(Record));
            d.firstName = data.field("firstName").decode(StringDecoder);
            d.lastName = data.field("lastName").decode(StringDecoder);
            return d;
        }
    
        static decodeContent(contentType: ContentType, data: Data): Version2 {
            return Version2.decode(data);
        }
    
        static encodeContent(contentType: ContentType, data: Version2): any {
            return this;
        }
    }
    
    export type All = Version1 | Version2;
    export const all = [Version1,Version2];
}
