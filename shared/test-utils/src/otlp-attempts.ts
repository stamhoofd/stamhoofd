import { channel } from 'node:diagnostics_channel';

/** Counts attempts, including refused connections to the SDK's default HTTP receiver. */
export function observeOtlpAttempts() {
    let attempts = 0;
    const count = (message: unknown) => {
        const path = (message as { request?: { path?: string } }).request?.path;
        if (path && /^\/v1\/(?:traces|logs|metrics)(?:\?|$)/.test(path)) attempts++;
    };
    const channels = ['http.client.request.created', 'undici:request:create'].map((name) =>
        channel(name),
    );
    for (const c of channels) c.subscribe(count);
    return {
        count: () => attempts,
        close() {
            for (const c of channels) c.unsubscribe(count);
        },
    };
}
