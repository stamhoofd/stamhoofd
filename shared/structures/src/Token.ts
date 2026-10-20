import type { Data, Encodeable, EncodeContext } from '@simonbackx/simple-encoding';
import { EncodeMedium } from '@simonbackx/simple-encoding';

/**
 * OAuth2 token data with absolute expiration dates in memory and snake_case wire keys.
 * Relative expires_in values and absolute expires_on extensions are both in seconds;
 * decoding prefers a supplied, nonzero absolute timestamp.
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

    /**
     * Relative expiry times are preferred, so the expiry is expressed in the device clock instead of the server clock.
     * Stored tokens (EncodeMedium.Database) use the absolute times, because the relative ones are outdated by then.
     */
    static decode(data: Data): Token {
        const preferAbsolute = data.context.medium === EncodeMedium.Database;
        const now = Date.now();

        const expiresOn = data.optionalField('expires_on')?.integer;
        const expiresIn = data.optionalField('expires_in')?.integer;
        const refreshExpiresOn = data.optionalField('refresh_expires_on')?.integer;
        const refreshExpiresIn = data.optionalField('refresh_expires_in')?.integer;

        const accessTokenValidUntil = (expiresOn !== undefined && (preferAbsolute || expiresIn === undefined))
            ? new Date(expiresOn * 1000)
            : new Date(now + data.field('expires_in').integer * 1000);

        let refreshTokenValidUntil: Date | null = null;
        if (refreshExpiresOn !== undefined && (preferAbsolute || refreshExpiresIn === undefined)) {
            refreshTokenValidUntil = new Date(refreshExpiresOn * 1000);
        } else if (refreshExpiresIn !== undefined) {
            refreshTokenValidUntil = new Date(now + refreshExpiresIn * 1000);
        }

        return new Token({
            accessToken: data.field('access_token').string,
            refreshToken: data.field('refresh_token').string,
            accessTokenValidUntil,
            refreshTokenValidUntil,
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
     * Using the refresh token after it expired signs the user out of every session, so it
     * may never be sent to the server anymore.
     */
    isRefreshTokenExpired(): boolean {
        return this.refreshTokenValidUntil !== null && this.refreshTokenValidUntil < new Date();
    }
}
