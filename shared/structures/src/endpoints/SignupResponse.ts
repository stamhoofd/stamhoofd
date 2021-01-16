import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { KeyConstants } from '../KeyConstants';

export class SignupResponse extends AutoEncoder {
    /**
     * Token used to validate the code
     */
    @field({ decoder: StringDecoder })
    token: string;

    /**
     * The needed keyconstants to obtain the authEncryptionKey from the password
     * (this avoids saving the password during verification)
     */
    @field({ decoder: KeyConstants })
    authEncryptionKeyConstants: KeyConstants;
}
