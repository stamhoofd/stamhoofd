import { Data } from '@/structs/classes/Data';

/// Only used as input
export class PasswordGrantStruct {
    /// Should be 'password'
    grantType: string;

    /// Username
    username: string;

    /// Password
    password: string;

    /// Optionally provide a new public key for this user.
    publicKey: string | undefined;

    static decode(data: Data): PasswordGrantStruct {
        const struct = new PasswordGrantStruct();
        struct.grantType = data.field("grant_type").string;
        struct.username = data.field("username").string;
        struct.password = data.field("password").string;
        struct.publicKey = data.optionalField("public_key")?.string;

        return struct;
    }
}
