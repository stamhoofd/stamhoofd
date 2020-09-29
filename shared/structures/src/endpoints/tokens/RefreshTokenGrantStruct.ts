import { Data } from '@simonbackx/simple-encoding';

/// Only used as input
export class RefreshTokenGrantStruct {
    /// Should be 'password'
    grantType: "refresh_token";

    /// Username
    refreshToken: string;

    

    static decode(data: Data): RefreshTokenGrantStruct {
        const struct = new RefreshTokenGrantStruct();
        struct.grantType = data.field("grant_type").equals("refresh_token");
        struct.refreshToken = data.field("refresh_token").string;

        return struct;
    }
}
