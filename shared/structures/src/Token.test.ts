import { ObjectData } from '@simonbackx/simple-encoding';
import { Token, Version } from '#/index.ts';

const MINUTE = 60 * 1000;

function createToken(refreshTokenValidUntil: Date | null): Token {
    return new Token({
        accessToken: 'access',
        refreshToken: 'refresh',
        accessTokenValidUntil: new Date(Date.now() + 15 * MINUTE),
        refreshTokenValidUntil,
    });
}

function reencode(token: Token): Token {
    return Token.decode(new ObjectData(token.encode({ version: Version }), { version: Version }));
}

describe('Token', () => {
    test('It keeps when the refresh token expires through encoding', () => {
        const validUntil = new Date(Math.floor((Date.now() + 3 * 60 * MINUTE) / 1000) * 1000);
        const decoded = reencode(createToken(validUntil));

        expect(decoded.refreshTokenValidUntil).toEqual(validUntil);
        expect(decoded.isRefreshTokenExpired()).toBe(false);
    });

    test('A token that does not say when its refresh token expires is not treated as expired', () => {
        const decoded = reencode(createToken(null));

        expect(decoded.refreshTokenValidUntil).toBeNull();
        expect(decoded.isRefreshTokenExpired()).toBe(false);
    });

    test('It knows when the refresh token expired', () => {
        expect(createToken(new Date(Date.now() - MINUTE)).isRefreshTokenExpired()).toBe(true);
        expect(createToken(new Date(Date.now() + MINUTE)).isRefreshTokenExpired()).toBe(false);
    });

    test('It accepts a relative refresh token expiry', () => {
        const decoded = Token.decode(new ObjectData({
            token_type: 'bearer',
            access_token: 'access',
            refresh_token: 'refresh',
            expires_in: 900,
            refresh_expires_in: -60,
        }, { version: Version }));

        expect(decoded.isRefreshTokenExpired()).toBe(true);
    });
});
