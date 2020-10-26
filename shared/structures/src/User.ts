import { ArrayDecoder, AutoEncoder, EmailDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { KeyConstants } from './KeyConstants';
import { Permissions } from './Permissions';

export class User extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    lastName: string | null = null;

    @field({ decoder: EmailDecoder })
    email: string;

    @field({ decoder: StringDecoder })
    publicKey: string;

    @field({ decoder: Permissions, nullable: true, version: 2, upgrade: () => null })
    permissions: Permissions | null = null
}

export class NewUser extends User {
    // The public key that is used for authentication. Should remain private to prevent brute force attacks on the client side (± same type of confidentiality as traditional password hashes)
    @field({ decoder: StringDecoder })
    publicAuthSignKey: string; 
    
    // The constants that are used to generate the auth (sign) keys
    @field({ decoder: KeyConstants })
    authSignKeyConstants: KeyConstants;

    // The constants that are used to generate the symmetrical encryption key with the user password that can decrypt and authenticate the root keys
    @field({ decoder: KeyConstants })
    authEncryptionKeyConstants: KeyConstants;

    // The encrypted private key, encrypted with the authEncryptionKey
    // this is the private key that is associated with publicKey
    @field({ decoder: StringDecoder })
    encryptedPrivateKey: string;
}