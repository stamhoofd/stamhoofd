import { Struct } from './Struct';

export class Number extends Struct {

    internalName(type: boolean): string {
        if (type) {
            return "number";
        }
        return "NumberDecoder";
    }

    definition(): string {
        // Implementation is built in
        return "";
    }
}