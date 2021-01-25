import { Request, RequestMiddleware, Server } from '@simonbackx/simple-networking';
import { Version } from '@stamhoofd/structures';

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class NetworkManagerStatic implements RequestMiddleware {
    displayedErrorMessage = false

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
        return Promise.resolve()
    }

    async shouldRetryNetworkError(request: Request<any>, error: Error): Promise<boolean> {
        console.error(error)
        await sleep(Math.min(((request as any).retryCount ?? 0) * 1000, 7000));

        if ((request as any).retryCount > 1 && !this.displayedErrorMessage) {
            this.displayedErrorMessage = true;
            // todo: present error message
        }
        return Promise.resolve(true);
    }

    onNetworkResponse(request: Request<any>, response: Response) {
        // todo: hide network error message
        this.displayedErrorMessage = false;
    }
}

export const NetworkManager = new NetworkManagerStatic()