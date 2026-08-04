import type { Data, Encodeable, EncodeContext } from '@simonbackx/simple-encoding';

/**
 * This is a custom encoded implementation since we need to follow the OAuth2 specification, which for some reason
 * returns a relative "expires_in" timestamp instead of an absolute value.
 */
export class Token implements Encodeable {
    accessToken: string;
    refreshToken: string;
    accessTokenValidUntil: Date;

    /**
     * When the refresh token stops working, so the client can stop using a session that
     * has ended instead of asking the server about it. Null when it is not known: a token
     * that was stored (or handed over) before this was communicated.
     */
    refreshTokenValidUntil: Date | null;

    constructor(token: { accessToken: string; refreshToken: string; accessTokenValidUntil: Date; refreshTokenValidUntil?: Date | null }) {
        this.accessToken = token.accessToken;
        this.refreshToken = token.refreshToken;
        this.accessTokenValidUntil = token.accessTokenValidUntil;
        this.refreshTokenValidUntil = token.refreshTokenValidUntil ?? null;
    }

    static decode(data: Data): Token {
        const expiresOn = data.optionalField('expires_on')?.integer;
        const refreshExpiresOn = data.optionalField('refresh_expires_on')?.integer;
        const refreshExpiresIn = data.optionalField('refresh_expires_in')?.integer;

        return new Token({
            accessToken: data.field('access_token').string,
            refreshToken: data.field('refresh_token').string,
            accessTokenValidUntil: new Date(expiresOn ? (expiresOn * 1000) : new Date().getTime() + data.field('expires_in').integer * 1000),
            refreshTokenValidUntil: refreshExpiresOn
                ? new Date(refreshExpiresOn * 1000)
                : (refreshExpiresIn !== undefined ? new Date(new Date().getTime() + refreshExpiresIn * 1000) : null),
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
            ...(this.refreshTokenValidUntil
                ? {
                        refresh_expires_in: Math.floor((this.refreshTokenValidUntil.getTime() - new Date().getTime()) / 1000),
                        refresh_expires_on: Math.floor(this.refreshTokenValidUntil.getTime() / 1000),
                    }
                : {}),
        };
    }

    needsRefresh(): boolean {
        return this.accessToken.length === 0 || this.accessTokenValidUntil < new Date();
    }

    /**
     * Whether this session has ended for sure. Using the refresh token after this signs the
     * user out of every session, so it may never be sent to the server anymore.
     */
    isRefreshTokenExpired(): boolean {
        return this.refreshTokenValidUntil !== null && this.refreshTokenValidUntil < new Date();
    }
}
