export class EmptyDecoder /* static implements ContentDecoder<object, {}> */ {
    static decode(data: any): {} {
        if (Object.keys(data).length === 0 && data.constructor === Object) {
            return {};
        }
        throw new Error("Expected an empty object");
    }
}
