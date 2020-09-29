import { Data } from '@simonbackx/simple-encoding';

/// Only used as input
export class RequestChallengeGrantStruct {
    grantType: "request_challenge";
    email: string;

    static decode(data: Data): RequestChallengeGrantStruct {
        const struct = new RequestChallengeGrantStruct();
        struct.grantType = data.field("grant_type").equals("request_challenge");
        struct.email = data.field("email").string;

        return struct;
    }
}
