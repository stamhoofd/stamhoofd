import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { Patchable } from '../classes/Patchable.js';

/**
 * Uses AutoEncoder metadata or a container-specific discriminator to distinguish patches from puts.
 */
export class PatchOrPutDecoder<Put extends Patchable<Patch>, Patch> implements Decoder<Patch | Put> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;

    constructor(put: Decoder<Put>, patch: Decoder<Patch>) {
        this.putDecoder = put;
        this.patchDecoder = patch;
    }

    decode(data: Data): Put | Patch {
        const isPatch = this.putDecoder.isPatchPayload
            ? this.putDecoder.isPatchPayload(data)
            : (data.optionalField('_isPatch')?.boolean ?? false);
        if (isPatch) {
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
