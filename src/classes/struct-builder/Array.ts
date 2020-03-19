import { Struct } from './Struct';

export class Array extends Struct {
    type: Struct;

    constructor(type: Struct) {
        super()
        this.type = type;
    }

    internalName(type: boolean): string {
        if (type) {
            return this.type.internalName(type) + "[]";
        }
        return "new ArrayDecoder(" + this.type.internalName(type) + ")";
    }

    definition(): string {
        // Implementation is built in
        return "";
    }
}