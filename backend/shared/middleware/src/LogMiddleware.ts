import { errorDiagnostics } from '@common/errors';
import type { Request, RequestMiddleware, ResponseMiddleware } from '@node/endpoints';
import { backendRecord, logger, StyledText } from '@node/logging';

let requestCounter = 0;
const requests = new WeakMap<Request, { index: number; start: number; endpoint?: string }>();

export function requestPrefix(request: Request, ...classes: string[]): StyledText[] {
    const state = requests.get(request);
    return [
        new StyledText(
            state ? `[R${state.index.toString().padStart(4, '0')}] ` : '[UNKNOWN REQUEST] ',
        ).addClass('request', 'tag', ...classes),
    ];
}

export const LogMiddleware: ResponseMiddleware & RequestMiddleware = {
    wrapRun(run, request) {
        requests.set(request, { index: ++requestCounter, start: performance.now() });
        return logger.setContext(
            { prefixes: requestPrefix(request, 'output'), tags: ['request', 'request-output'] },
            run,
        );
    },
    handleDecodedRequest(decoded, endpoint) {
        const state = requests.get(decoded.request);
        if (state) state.endpoint = endpoint.constructor.name;
    },
    handleResponse(request, response, error) {
        if (
            request.method === 'OPTIONS' ||
            (request.localTraceQueued && response.status >= 200 && response.status < 300)
        )
            return;
        const state = requests.get(request);
        if (error && response.status >= 500) {
            logger.error(
                ...requestPrefix(request, 'error'),
                'HTTP request failed',
                state?.endpoint,
                errorDiagnostics(error),
            );
        }
        backendRecord(
            'http.response',
            request.method,
            response.status,
            state && performance.now() - state.start,
            request,
        );
    },
};
