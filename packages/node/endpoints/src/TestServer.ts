import { Encodeable } from '@common/encoding';

import { EncodedResponse } from './EncodedResponse.js';
import { Endpoint } from './Endpoint.js';
import { Request } from './Request.js';
import { RequestMiddleware } from './RequestMiddleware.js';
import { Response } from './Response.js';
import { ResponseMiddleware } from './ResponseMiddleware.js';

/**
 * Adds request middeware functionality to tests
 */
export class TestServer {
    requestMiddlewares: RequestMiddleware[] = [];
    responseMiddlewares: ResponseMiddleware[] = [];

    addRequestMiddleware(middleware: RequestMiddleware) {
        this.requestMiddlewares.push(middleware);
    }

    addResponseMiddleware(middleware: ResponseMiddleware) {
        this.responseMiddlewares.push(middleware);
    }

    async test<ResponseBody extends Encodeable | Encodeable[] | string | Buffer | undefined>(endpoint: Endpoint<any, any, any, ResponseBody>, request: Request): Promise<Response<ResponseBody>> {
        let run = async () => {
            // Process response middlewares
            for (const middleware of this.requestMiddlewares) {
                if (middleware.handleRequest) {
                    await middleware.handleRequest(request);
                }
            }

            const decoded = await endpoint.decode(request);
            if (decoded === null) {
                throw new Error('Route is not matching');
            }

            for (const middleware of this.requestMiddlewares) {
                if (middleware.handleDecodedRequest) {
                    await middleware.handleDecodedRequest(decoded, endpoint);
                }
            }

            const response = await endpoint.handle(decoded);

            if (!response) {
                throw new Error('Route is not matching');
            }

            // Process response middlewares
            for (const middleware of this.responseMiddlewares) {
                await middleware.handleResponse(request, response);
            }

            // Encode - but ignore the encoded result (we only want to check if it works)
            EncodedResponse.encode(response, request);
            return response;
        };

        for (const middleware of this.requestMiddlewares) {
            const currentRun = run;
            const wrapRun = middleware.wrapRun;
            run = wrapRun ? async () => wrapRun(currentRun, request) : currentRun;
        }

        return await run();
    }
}
