
import { Data } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { ChallengeGrantStruct } from './ChallengeGrantStruct';
import { PasswordTokenGrantStruct } from './PasswordTokenGrantStruct';
import { RefreshTokenGrantStruct } from './RefreshTokenGrantStruct';
import { RequestChallengeGrantStruct } from './RequestChallengeGrantStruct';

/// Only used as input
export class CreateTokenStruct {
    static decode(data: Data): ChallengeGrantStruct | RefreshTokenGrantStruct | RequestChallengeGrantStruct | PasswordTokenGrantStruct {
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

        if (grantType == "password_token") {
            return PasswordTokenGrantStruct.decode(data)
        }

        throw new SimpleError({
            code: "invalid_field",
            message: "Unsupported grant_type",
            field: data.addToCurrentField("grant_type")
        })
    }
}
