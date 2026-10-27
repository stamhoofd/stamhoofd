import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { Patchable } from '../classes/Patchable.js';

/**
 * Uses the meta data of AutoEncoder to check if something is a patch or a put
 */
export class PatchOrPutDecoder<Put extends Patchable<Patch>, Patch> implements Decoder<Patch | Put> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;

    constructor(put: Decoder<Put>, patch: Decoder<Patch>) {
        this.putDecoder = put;
        this.patchDecoder = patch;
    }

    decode(data: Data): Put | Patch {
        const isPatch = data.optionalField('_isPatch');
        if (isPatch?.boolean ?? false) {
            return this.patchDecoder.decode(data);
        }

        return this.putDecoder.decode(data);
    }

    isDefaultValue(value: unknown): boolean {
        return this.patchDecoder.isDefaultValue ? this.patchDecoder.isDefaultValue(value) : false;
    }

    getDefaultValue(): Patch | Put | undefined {
        return this.patchDecoder.getDefaultValue ? this.patchDecoder.getDefaultValue() : (undefined as any);
    }
}
