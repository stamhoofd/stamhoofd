import { Server } from '@stamhoofd-frontend/networking';

import { Token } from './Token';

/**
 * A token that can get saved and refreshed
 */
export class ManagedToken {
    /** Unique ID for which this token will get saved in the keychain */
    id: string;
    token: Token;
    private refreshPromise?: Promise<void>;

    constructor(id: string, token: Token) {
        this.id = id
        this.token = token;
    }

    /**
     * Refresh the token itself, without generating a new token. Everyone who had the token has a new token now
     */
    private async doRefresh(server: Server): Promise<void> {
        const result = await server.request({
            method: "POST",
            path: "/oauth/token",
            body: {
                // eslint-disable-next-line @typescript-eslint/camelcase
                grant_type: "refresh_token",
                // eslint-disable-next-line @typescript-eslint/camelcase
                refresh_token: this.token.refreshToken
            },
            decoder: Token
        })

        this.token = result.data
        await this.storeInKeyChain()
    }

    needsRefresh(): boolean {
        return this.token.needsRefresh()
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

    async storeInKeyChain() {
        if (!process.env.IS_ELECTRON) {
            // Store in different place
            return;
        }
        const keytar = await import("keytar")
        await keytar.setPassword("be.stamhoofd.account.token", this.id, this.token.refreshToken);
    }

    /// Requires network (could get adjusted)
    static async restoreFromKeyChain(id: string): Promise<ManagedToken | undefined> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (!process.env.IS_ELECTRON) {
            // Store in different place
            return;
        }

        const keytar = await import("keytar")
        const refreshToken = await keytar.getPassword("be.stamhoofd.account.token", id)

        if (!refreshToken) {
            return
        }
        const token = new Token({
            accessToken: "",
            refreshToken: refreshToken,
            accessTokenValidUntil: new Date(Date.now() - 1000)
        });
        return new ManagedToken(id, token)
    }
}