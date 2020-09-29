import { Data } from '@simonbackx/simple-encoding';

export class PasswordTokenGrantStruct {
    grantType: "password_token";
    token: string;

    static decode(data: Data): PasswordTokenGrantStruct {
        const struct = new PasswordTokenGrantStruct();
        struct.grantType = data.field("grant_type").equals("password_token");
        struct.token = data.field("token").string;

        return struct;
    }
}
