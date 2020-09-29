import { Data } from '@simonbackx/simple-encoding';

/// Only used as input
export class ChallengeGrantStruct {
    grantType: "challenge";
    email: string;
    challenge: string;
    signature: string;

    static decode(data: Data): ChallengeGrantStruct {
        const struct = new ChallengeGrantStruct();
        struct.grantType = data.field("grant_type").equals("challenge");
        struct.email = data.field("email").string;
        struct.challenge = data.field("challenge").string;
        struct.signature = data.field("signature").string;

        return struct;
    }
}
