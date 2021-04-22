import { Data } from '@simonbackx/simple-encoding';

export class PasswordGrantStruct {
    grantType: "password";
    password: string;
    username: string;

    static decode(data: Data): PasswordGrantStruct {
        const struct = new PasswordGrantStruct();
        struct.grantType = data.field("grant_type").equals("password");
        struct.password = data.field("password").string;
        struct.username = data.field("username").string;

        return struct;
    }
}
