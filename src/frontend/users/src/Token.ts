import { Data } from '@stamhoofd-common/encoding';

export class Token {
    accessToken: string;
    refreshToken: string;
    accessTokenValidUntil: Date;

    constructor(data: { accessToken: string; refreshToken: string; accessTokenValidUntil: Date}) {
        this.accessToken = data.accessToken
        this.refreshToken = data.refreshToken
        this.accessTokenValidUntil = data.accessTokenValidUntil
    }

    static decode(data: Data): Token {
        return new Token({
            accessToken: data.field("access_token").string,
            refreshToken: data.field("refresh_token").string,
            accessTokenValidUntil: new Date(Date.now() + data.field("expires_in").number * 1000 - 30 * 1000),
        });            
    }

    needsRefresh(): boolean {
        return this.accessToken.length == 0 || this.accessTokenValidUntil < new Date()
    }
}