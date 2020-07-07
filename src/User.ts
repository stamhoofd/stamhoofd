import { AutoEncoder, EmailDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { EncryptedPrivateKeyBox } from './EncryptedPrivateKeyBox';

export class User extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: EmailDecoder })à
    email: string;

    @field({ decoder: StringDecoder })
    publicKey: string;
}

export class NewUser extends User {
    // The public key that is used for authentication
    @field({ decoder: StringDecoder })
    authPublicKey: string;
}