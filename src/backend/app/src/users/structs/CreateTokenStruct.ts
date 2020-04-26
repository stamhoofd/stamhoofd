import { Data } from '@stamhoofd-common/encoding';
import { STError } from '@stamhoofd-common/errors';

import { PasswordGrantStruct } from './PasswordGrantStruct';
import { RefreshTokenGrantStruct } from './RefreshTokenGrantStruct';

/// Only used as input
export class CreateTokenStruct {
    static decode(data: Data): PasswordGrantStruct | RefreshTokenGrantStruct {
        const grantType = data.field("grant_type").string;
        if (grantType == "password") {
            return PasswordGrantStruct.decode(data)
        }

        if (grantType == "refresh_token") {
            return RefreshTokenGrantStruct.decode(data)
        }

        throw new STError({
            code: "invalid_field",
            message: "Unsupported grant_type",
            field: data.addToCurrentField("grant_type")
        })
    }
}
