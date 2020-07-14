import { Data, Decoder, Encodeable, EncodeContext } from "@simonbackx/simple-encoding";

import { KeychainItem } from '../KeychainItem';

/**
 * Returns the response data, along with related keychain items that might be needed to decrypt the data
 */
export class KeychainedResponse<T extends Encodeable | Encodeable[]> implements Encodeable {
    data: T;
    keychainItems: KeychainItem[];

    constructor(data: { data: T; keychainItems: KeychainItem[] }) {
        this.data = data.data
        this.keychainItems = data.keychainItems
    }

    encode(context: EncodeContext) {
        if (Array.isArray(this.data)) {
            return {
                data: this.data.map(r => r.encode(context)),
                keychainItems: this.keychainItems.map(r => r.encode(context)),
            };
        }
        return {
            data: (this.data as Encodeable).encode(context),
            keychainItems: this.keychainItems.map(r => r.encode(context)),
        };
    }
}

export class KeychainedResponseDecoder<T extends Encodeable | Encodeable[]> implements Decoder<KeychainedResponse<T>> {
    dataDecoder: Decoder<T>

    constructor(dataDecoder: Decoder<T>) {
        this.dataDecoder = dataDecoder
    }

    decode(data: Data) {
        return new KeychainedResponse<T>({
            data: data.field('data').decode(this.dataDecoder),
            keychainItems: data.field('keychainItems').array(KeychainItem as Decoder<KeychainItem>),
        })
    }
}