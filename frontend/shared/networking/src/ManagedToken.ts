import { Server } from '@simonbackx/simple-networking';
import { Token } from '@stamhoofd/structures';

/**
 * A token that can get saved and refreshed
 */
export class ManagedToken {
    token: Token;
    private refreshPromise?: Promise<void>;
    onChange: () => void

    constructor(token: Token, onChange: () => void) {
        this.token = token;
        this.onChange = onChange
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
        this.onChange()
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
}