
export class NumberDecoder /* static implements Decoder<string> */ {
    static decode(data: any): number {
        if (typeof data == "number") {
            return data;
        }
        throw new Error("Expected a number");
    }
}