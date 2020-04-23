import { Encodeable } from '@stamhoofd-common/encoding';

import { Token } from "../models/Token";

/// Only used as output
export class TokenStruct implements Encodeable {
    accessToken: string;
    refreshToken: string;
    accessTokenValidUntil: Date;

    constructor(token: Token) {
        this.accessToken = token.accessToken
        this.refreshToken = token.refreshToken
        this.accessTokenValidUntil = token.accessTokenValidUntil
    }

    encode(): any {
        // We convert to snake case, as specified in the OAuth2 specs
        return {
            "access_token": this.accessToken,
            "token_type": "bearer",
            "expires_in": (this.accessTokenValidUntil.getTime() - new Date().getTime()) / 1000,
            "refresh_token": this.refreshToken,
        };
    }
}
