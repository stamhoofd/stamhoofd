import type { SimpleErrors } from '@common/errors';
import type { Request, RequestMiddleware} from '@common/networking';
import { Server } from '@common/networking';
import { Toast } from '@stamhoofd/frontend-notifications/Toast';
import { Version } from '@stamhoofd/structures';

import { getNetworkingConfiguration } from './NetworkingConfiguration';
import { waitForNetworkOnline } from './utility/waitForNetworkOnline';

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class NetworkManagerStatic implements RequestMiddleware {
    networkErrorToast: Toast | null = null;
    platformLatestVersion: number | null = null;
    serverName: string | null = null;

    /**
     * Total request with a network error that are being retried
     */
    retryingRequestsCount = 0;

    /**
     * Normal, non authenticated requests
     */
    get server() {
        const server = new Server('https://' + STAMHOOFD.domains.api);
        server.middlewares.push(this);

        // Set the version in which we decode the responses
        server.setVersionHeaders(['X-Version']);
        return server;
    }

    /**
     * Normal, non authenticated requests
     */
    get rendererServer() {
        const server = new Server('https://' + STAMHOOFD.domains.rendererApi);
        server.middlewares.push(this);

        // Set the version in which we decode the responses
        server.setVersionHeaders(['X-Version']);
        return server;
    }

    async onBeforeRequest(request: Request<any>): Promise<void> {
        request.version = Version;
        (request as any).retryCount = ((request as any).retryCount ?? 0) + 1;

        Object.assign(request.headers, await getNetworkingConfiguration().getRequestHeaders());
    }

    /**
     * Retry transport failures without a count limit while the request allows it.
     * Online delay grows linearly to 10 seconds; offline waits for connectivity or
     * 10 seconds. Repeated failures share a loading toast. Cancellation stops retries.
     */
    async shouldRetryNetworkError(request: Request<any>, error: Error): Promise<boolean> {
        console.error('network error', error);
        if (!(request as any).isRetrying) {
            (request as any).isRetrying = true;
            this.retryingRequestsCount++;
        }

        if ((request as any).retryCount > 1 && !this.networkErrorToast) {
            // Only on second try
            this.networkErrorToast = new Toast($t(`%ks`), 'spinner').setHide(null).show();
        }

        if (navigator.onLine) {
            // Normal timeout behaviour: browser probably doesn't know about network issues, so we need to 'poll'
            await sleep(Math.min(((request as any).retryCount ?? 0) * 1000, 10 * 1000));
            return Promise.resolve(true);
        }
        else {
            // Wait for network or 10 seconds (the fastest one)
            await waitForNetworkOnline(10000);
            return Promise.resolve(true);
        }
    }

    async shouldRetryServerError(request: Request<any>, response: XMLHttpRequest, error: Error): Promise<boolean> {
        console.error('server error', error);
        console.error(error);
        console.error(response);
        return Promise.resolve(false);
    }

    async shouldRetryError(request: Request<any>, response: XMLHttpRequest, error: SimpleErrors): Promise<boolean> {
        console.error('response error');
        console.error(error);

        try {
            if (error.hasCode('client_update_required')) {
                getNetworkingConfiguration().onClientUpdateRequired(error);
            }
        }
        catch (e) {
            console.error(e);
        }

        return Promise.resolve(false);
    }

    onFatalNetworkError(request: Request<any>, error: Error) {
        if ((request as any).isRetrying) {
            (request as any).isRetrying = false;
            this.retryingRequestsCount--;
        }

        if (this.networkErrorToast && this.retryingRequestsCount == 0) {
            this.networkErrorToast.hide();
            this.networkErrorToast = null;
        }
    }

    onNetworkResponse(request: Request<any>, response: XMLHttpRequest) {
        if ((request as any).isRetrying) {
            (request as any).isRetrying = false;
            this.retryingRequestsCount--;
        }

        if (this.networkErrorToast && this.retryingRequestsCount == 0) {
            this.networkErrorToast.hide();
            this.networkErrorToast = null;
        }

        // Check headers
        const str = response.getResponseHeader('X-Platform-Latest-Version');
        if (str) {
            const latestVersion = parseInt(str);
            if (!this.platformLatestVersion || this.platformLatestVersion < latestVersion) {
                console.log('Latest platform version is ' + latestVersion);
                this.platformLatestVersion = latestVersion;

                if (this.platformLatestVersion > Version) {
                    getNetworkingConfiguration().onNewerVersion(this.platformLatestVersion);
                }
            }
        }

        const serverName = response.getResponseHeader('X-Server');
        if (serverName) {
            this.serverName = serverName;
        }
    }
}

export const NetworkManager = new NetworkManagerStatic();
