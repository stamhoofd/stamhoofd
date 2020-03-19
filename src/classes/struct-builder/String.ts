import { Struct } from './Struct';

export class String extends Struct {

    internalName(type: boolean): string {
        if (type) {
            return "string";
        }
        return "StringDecoder";
    }

    definition(): string {
        // Implementation is built in
        return "";
    }
}