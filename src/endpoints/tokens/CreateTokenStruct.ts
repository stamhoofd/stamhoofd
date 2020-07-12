
import { Data, DecodingError } from '@simonbackx/simple-encoding';

import { ChallengeGrantStruct } from './ChallengeGrantStruct';
import { RefreshTokenGrantStruct } from './RefreshTokenGrantStruct';
import { RequestChallengeGrantStruct } from './RequestChallengeGrantStruct';

/// Only used as input
export class CreateTokenStruct {
    static decode(data: Data): ChallengeGrantStruct | RefreshTokenGrantStruct | RequestChallengeGrantStruct {
        const grantType = data.field("grant_type").string;
        if (grantType == "challenge") {
            return ChallengeGrantStruct.decode(data)
        }

        if (grantType == "refresh_token") {
            return RefreshTokenGrantStruct.decode(data)
        }

        if (grantType == "request_challenge") {
            return RequestChallengeGrantStruct.decode(data)
        }

        throw new DecodingError({
            code: "invalid_field",
            message: "Unsupported grant_type",
            field: data.addToCurrentField("grant_type")
        })
    }
}
