import { SimpleError } from '@simonbackx/simple-errors';
import type { Server } from '@simonbackx/simple-networking';
import { Request } from '@simonbackx/simple-networking';
import { Token } from '@stamhoofd/structures';

import { waitForNetworkOnline } from './utility/waitForNetworkOnline';

/**
 * A token that can get saved and refreshed
 */
export class ManagedToken {
    token: Token;
    private refreshPromise?: Promise<void>;
    onChange: () => Promise<void> | void;

    constructor(token: Token, onChange: () => Promise<void> | void) {
        this.token = token;
        this.onChange = onChange;
    }

    /**
     * Refresh the token itself, without generating a new token. Everyone who had the token has a new token now
     */
    private async doRefresh(server: Server): Promise<void> {
        if (this.token.isRefreshTokenExpired()) {
            // The server signs out every session of the user when it receives a refresh
            // token that expired, because that can mean the token was stolen. A session we
            // know has ended may therefore never be sent: it would take the sessions on the
            // other devices of this user with it.
            throw new SimpleError({
                code: 'invalid_refresh_token',
                message: 'The session has expired',
                human: $t(`%ky`),
            });
        }

        const result = await server.request({
            method: 'POST',
            path: '/oauth/token',
            body: {
                grant_type: 'refresh_token',
                refresh_token: this.token.refreshToken,
            },
            decoder: Token,
            shouldRetry: false,
        });

        this.token = result.data;
        await this.onChange();
    }

    needsRefresh(): boolean {
        return this.token.needsRefresh();
    }

    isRefreshing(): boolean {
        return this.refreshPromise !== undefined;
    }

    /**
     * Refreshes the token and sets a new acces token. Throws on failure.
     * Multiple calls only do one refresh at a time and resolve simultaneously
     */
    async refresh(server: Server, shouldRetry?: () => boolean): Promise<void> {
        try {
            if (this.refreshPromise) {
                return this.refreshPromise;
            }

            try {
                this.refreshPromise = this.doRefresh(server);
                await this.refreshPromise;
            }
            finally {
                this.refreshPromise = undefined;
            }
        }
        catch (e) {
            if (shouldRetry && Request.isNetworkError(e)) {
                const should = shouldRetry();
                if (!should) {
                    throw e;
                }
                console.log('Retry token refresh due to network error');
                await waitForNetworkOnline(7000);

                // Check again, the value could have changed
                const should2 = shouldRetry();
                if (!should2) {
                    throw e;
                }
                return await this.refresh(server, shouldRetry);
            }
            throw e;
        }
    }
}
