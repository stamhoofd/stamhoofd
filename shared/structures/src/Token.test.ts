import { EncodeMedium, ObjectData } from '@simonbackx/simple-encoding';
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
    const context = { version: Version, medium: EncodeMedium.Database };
    return Token.decode(new ObjectData(token.encode(context), context));
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

    describe('Device clock differs from the server clock', () => {
        const serverNow = Date.now() - 60 * MINUTE;
        const serverResponse = {
            token_type: 'bearer',
            access_token: 'access',
            refresh_token: 'refresh',
            expires_in: 15 * 60,
            expires_on: Math.floor((serverNow + 15 * MINUTE) / 1000),
            refresh_expires_in: 3 * 60 * 60,
            refresh_expires_on: Math.floor((serverNow + 3 * 60 * MINUTE) / 1000),
        };

        test('A token received from the network expires relative to the device clock', () => {
            const decoded = Token.decode(new ObjectData(serverResponse, { version: Version, medium: EncodeMedium.Network }));

            expect(decoded.needsRefresh()).toBe(false);
            expect(decoded.isRefreshTokenExpired()).toBe(false);
            expect(Math.abs(decoded.accessTokenValidUntil.getTime() - (Date.now() + 15 * MINUTE))).toBeLessThan(MINUTE);
        });

        test('A stored token keeps its absolute expiry', () => {
            const decoded = Token.decode(new ObjectData(serverResponse, { version: Version, medium: EncodeMedium.Database }));
            expect(decoded.accessTokenValidUntil.getTime()).toBe(serverResponse.expires_on * 1000);
            expect(decoded.refreshTokenValidUntil?.getTime()).toBe(serverResponse.refresh_expires_on * 1000);
        });

        test('A stored token survives encoding for storage', () => {
            const token = createToken(new Date(Math.floor((Date.now() + 3 * 60 * MINUTE) / 1000) * 1000));
            const context = { version: Version, medium: EncodeMedium.Database };
            const decoded = Token.decode(new ObjectData(token.encode(context), context));

            expect(decoded.accessTokenValidUntil.getTime()).toBe(Math.floor(token.accessTokenValidUntil.getTime() / 1000) * 1000);
            expect(decoded.refreshTokenValidUntil).toEqual(token.refreshTokenValidUntil);
        });
    });
});
