import { Request, RequestMiddleware } from '@stamhoofd-frontend/networking';

import { Token } from './Token';

export class AuthenticationMiddleware implements RequestMiddleware {
    token?: Token;
    constructor(token: Token) {
        this.token = token;
    }

    async onBeforeRequest(request: Request<any>): Promise<void> {
        if (!this.token) {
            // Euhm? The user is not signed in!
            throw new Error("Could not authenticate request without token")
        }

        if (this.token.isRefreshing() || this.token.needsRefresh()) {
            // Already expired.
            await this.token.refresh()
        }

        request.headers["Authorization"] = "Bearer "+this.token.accessToken;
    }
    shouldRetryRequest(request: Request<any>, response: Response): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    shouldRetryError(request: Request<any>, error: Error): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}
