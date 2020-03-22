
export class StringDecoder /* static implements Decoder<string> */ {
    static decode(data: any): string {
        if (typeof data == "string") {
            return data;
        }
        throw new Error("Expected a string");
    }
}