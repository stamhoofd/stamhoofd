import { Data } from '@stamhoofd-common/encoding';

import { Server } from '../../networking';

export class Token {
    accessToken: string;
    refreshToken: string;
    accessTokenValidUntil: Date;
    private refreshPromise?: Promise<void>

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
     * Persist this token in a keychain, or other method that is available
     */
    async storeInKeyChain() {
        if (!process.env.IS_ELECTRON) {
            return;
        }
        const keytar = await import("keytar")
        await keytar.setPassword("be.stamhoofd.account.token", "todo", this.refreshToken);
    }

    static async restoreFromKeyChain(): Promise<Token | undefined> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (!process.env.IS_ELECTRON) {
            return;
        }

        const keytar = await import("keytar")
        const credentials = await keytar.findCredentials("be.stamhoofd.account.token")
        if (credentials.length > 0) {
            return new Token({
                accessToken: "",
                refreshToken: credentials[0].password,
                accessTokenValidUntil: new Date(Date.now() - 1000)
            })
        }
    }

    /**
     * Refresh the token itself, without generating a new token. Everyone who had the token has a new token now
     */
    private async doRefresh(): Promise<void> {
        const server = new Server();
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

        if (!data.data) {
            throw new Error("Refresh failed")
        }

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
    async refresh(): Promise<void> {
        if (this.refreshPromise) {
            return this.refreshPromise
        }
        this.refreshPromise = this.doRefresh()
        await this.refreshPromise
        this.refreshPromise = undefined
    }
}