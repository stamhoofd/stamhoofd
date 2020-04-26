import { Data } from '@stamhoofd-common/encoding';

/// Only used as input
export class PasswordGrantStruct {
    /// Should be 'password'
    grantType: "password";

    /// Username
    username: string;

    /// Password
    password: string;

    /**
     * Name or description of the device that is executing the request. Won't get saved to the server, but is needed because we might need to send security notices via email (e.g. failed password attempts)
     */
    deviceName: string;

    static decode(data: Data): PasswordGrantStruct {
        const struct = new PasswordGrantStruct();
        struct.grantType = data.field("grant_type").equals("password");
        struct.username = data.field("username").string;
        struct.password = data.field("password").string;
        struct.deviceName = data.field("deviceName").string;

        return struct;
    }
}
