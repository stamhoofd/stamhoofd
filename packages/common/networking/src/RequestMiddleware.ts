import { SimpleErrors } from '@simonbackx/simple-errors';

import { Request } from './Request';

/**
 * Extend requests without a built-in backoff or authentication policy.
 * Shared middleware runs before request middleware. Before-request hooks are
 * awaited on every attempt and may update headers/version or reject the request.
 * Retry hooks return true to retry, optionally after awaiting a delay; subsequent
 * retry hooks may be skipped once a previous hook approved the retry.
 */
export interface RequestMiddleware {
    onBeforeRequest?(request: Request<any>): Promise<void>;
    /** Decoded API errors; enabled by shouldRetry OR allowErrorRetry. */
    shouldRetryError?(request: Request<any>, response: XMLHttpRequest, error: SimpleErrors): Promise<boolean>;
    /** Invalid responses (e.g. malformed JSON); enabled by shouldRetry. */
    shouldRetryServerError?(request: Request<any>, response: XMLHttpRequest, error: Error): Promise<boolean>; // e.g. invalid json
    /** Transport/encoding failures; enabled by shouldRetry. Cancellation stops retrying. */
    shouldRetryNetworkError?(request: Request<any>, error: Error): Promise<boolean>;

    /**
     * Called when a network request is not retried
     */
    onFatalNetworkError?(request: Request<any>, error: Error);
    onNetworkResponse?(request: Request<any>, response: XMLHttpRequest);
}
