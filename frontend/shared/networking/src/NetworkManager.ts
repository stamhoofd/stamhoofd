import { Request, RequestMiddleware, Server } from '@simonbackx/simple-networking';
import { Toast } from '@stamhoofd/components';
import { Version } from '@stamhoofd/structures';

import { AppManager } from './AppManager';

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class NetworkManagerStatic implements RequestMiddleware {
    networkErrorToast: Toast | null = null
    platformLatestVersion: number | null = null

    /**
     * Total request with a network error that are being retried
     */
    retryingRequestsCount = 0

    /**
     * Normal, non authenticated requests
     */
    get server() {
        const server = new Server("https://"+process.env.HOSTNAME_API)
        server.middlewares.push(this)
        return server
    }

    onBeforeRequest(request: Request<any>): Promise<void> {
        request.version = Version;
        (request as any).retryCount = ((request as any).retryCount ?? 0) + 1

        request.headers["X-Platform"] = AppManager.shared.platform
        return Promise.resolve()
    }

    /**
     * Wait 10 seconds or shorter if the network becomes online in those 10 seconds
     */
    networkOnlinePromise(timeout = 10000): Promise<void> {
        return new Promise((resolve) => {
            let resolved = false
            const listener = function() { 
                if (resolved) {
                    return
                }
                resolved = true

                // Self reference to always remote the listener
                window.removeEventListener('online', listener)
                resolve()
            }
            window.addEventListener('online', listener)
            setTimeout(listener, timeout)
        })
    }

    async shouldRetryNetworkError(request: Request<any>, error: Error): Promise<boolean> {
        console.error("network error", error)
        if (!(request as any).isRetrying) {
            (request as any).isRetrying = true
            this.retryingRequestsCount++
        }

        if ((request as any).retryCount > 1 && !this.networkErrorToast) {
            // Only on second try
            this.networkErrorToast = new Toast("Bezig met verbinden met internet...", "spinner").setHide(null).show()
        }

        if (navigator.onLine) {
            // Normal timeout behaviour: browser probably doesn't know about network issues, so we need to 'poll'
            await sleep(Math.min(((request as any).retryCount ?? 0) * 1000, 7000));
            return Promise.resolve(true);
        } else {
            // Wait for network or 10 seconds (the fastest one)
            await this.networkOnlinePromise(10000)
            return Promise.resolve(true);
        }
    }

    async shouldRetryServerError(request: Request<any>, response: XMLHttpRequest, error: Error): Promise<boolean> {
        console.error("server error", error)
        console.error(error)
        console.error(response)
        return Promise.resolve(false);
    }

    onFatalNetworkError(request: Request<any>, error: Error) {
        if ((request as any).isRetrying) {
            (request as any).isRetrying = false
            this.retryingRequestsCount--
        }

        if (this.networkErrorToast && this.retryingRequestsCount == 0) {
            this.networkErrorToast.hide()
            this.networkErrorToast = null;
        }
    }

    onNetworkResponse(request: Request<any>, response: XMLHttpRequest) {
        if ((request as any).isRetrying) {
            (request as any).isRetrying = false
            this.retryingRequestsCount--
        }

        if (this.networkErrorToast && this.retryingRequestsCount == 0) {
            this.networkErrorToast.hide()
            this.networkErrorToast = null;
        }

        // Check headers
        const str = response.getResponseHeader("X-Platform-Latest-Version")
        if (str) {
            const latestVersion = parseInt(str);
            if (!this.platformLatestVersion || this.platformLatestVersion < latestVersion) {
                console.log("Latest platform version is "+latestVersion)
                this.platformLatestVersion = latestVersion

                if (this.platformLatestVersion > Version) {
                    if (AppManager.shared.isNative) {
                        new Toast("Er is een update beschikbaar. Update de app om te vermijden dat bepaalde zaken stoppen met werken. Tip: houd automatische updates ingeschakeld.", "yellow download").setHide(null).show()
                    } else {
                        new Toast("Er is een update beschikbaar. Herlaad de pagina zodra het kan om te vermijden dat bepaalde zaken stoppen met werken.", "yellow download").setHide(null).show()
                    }
                }
            }  
        }
    }
}

export const NetworkManager = new NetworkManagerStatic()