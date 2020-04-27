import { Data } from '@stamhoofd-common/encoding';
import { Server } from '@stamhoofd-frontend/networking';

export class Token {
    accessToken: string;
    refreshToken: string;
    accessTokenValidUntil: Date;
    private refreshPromise?: Promise<void>;

    constructor(data: { accessToken: string; refreshToken: string; accessTokenValidUntil: Date}) {
        this.accessToken = data.accessToken
        this.refreshToken = data.refreshToken
    }

    static decode(data: Data): Token {
        return new Token({
            accessToken: data.field("access_token").string,
            refreshToken: data.field("refresh_token").string,
            accessTokenValidUntil: new Date(Date.now() + data.field("expires_in").number * 1000 - 30 * 1000),
        });            
    }

    /**
     * Refresh the token itself, without generating a new token. Everyone who had the token has a new token now
     */
    private async doRefresh(server: Server): Promise<void> {
        const data = await server.request({
            method: "POST",
            path: "/oauth/token",
            body: {
                // eslint-disable-next-line @typescript-eslint/camelcase
                grant_type: "refresh_token",
                // eslint-disable-next-line @typescript-eslint/camelcase
                refresh_token: this.refreshToken
            },
            decoder: Token
        })

        this.accessToken = data.data.accessToken
        this.refreshToken = data.data.refreshToken
        this.accessTokenValidUntil = data.data.accessTokenValidUntil
    }

    needsRefresh(): boolean {
        return this.accessToken.length == 0 || this.accessTokenValidUntil < new Date()
    }

    isRefreshing(): boolean {
        return this.refreshPromise != undefined
    }

    /**
     * Refreshes the token and sets a new acces token. Throws on failure.
     * Multiple calls only do one refresh at a time and resolve simultaneously
     */
    async refresh(server: Server): Promise<void> {
        if (this.refreshPromise) {
            return this.refreshPromise
        }
        try {
            this.refreshPromise = this.doRefresh(server)
            await this.refreshPromise
        } finally {
            this.refreshPromise = undefined
        }
    }
}