import { Data, Encodeable, EncodeContext } from '@simonbackx/simple-encoding';

/**
 * This is a custom encoded implementation since we need to follow the OAuth2 specification, which for some reason
 * returns a relative "expires_in" timestamp instead of an absolute value.
 */
export class Token implements Encodeable {
    accessToken: string;
    refreshToken: string;
    accessTokenValidUntil: Date;

    constructor(token: { accessToken: string; refreshToken: string; accessTokenValidUntil: Date }) {
        this.accessToken = token.accessToken;
        this.refreshToken = token.refreshToken;
        this.accessTokenValidUntil = token.accessTokenValidUntil;
    }

    static decode(data: Data): Token {
        const expiresOn = data.optionalField('expires_on')?.integer;
        return new Token({
            accessToken: data.field('access_token').string,
            refreshToken: data.field('refresh_token').string,
            accessTokenValidUntil: new Date(expiresOn ? expiresOn : new Date().getTime() + data.field('expires_in').integer * 1000),
        });
    }

    encode(_context: EncodeContext): any {
        // We convert to snake case, as specified in the OAuth2 specs
        return {
            token_type: 'bearer',
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            expires_in: Math.floor((this.accessTokenValidUntil.getTime() - new Date().getTime()) / 1000),
            expires_on: Math.floor(this.accessTokenValidUntil.getTime() / 1000),
        };
    }

    needsRefresh(): boolean {
        return this.accessToken.length === 0 || this.accessTokenValidUntil < new Date();
    }
}
