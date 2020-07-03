import { AutoEncoder, EmailDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { EncryptedPrivateKeyBox } from './EncryptedPrivateKeyBox';

export class User extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: EmailDecoder })
    email: string;

    @field({ decoder: StringDecoder })
    publicKey: string;
}

/**
 * Variant of user when updating the current user password or when creating a new user
 */
export class NewUser extends User {
    @field({ decoder: EncryptedPrivateKeyBox })
    encryptedPrivateKey: EncryptedPrivateKeyBox;

    @field({ decoder: StringDecoder })
    password: string;
}