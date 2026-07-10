import type { Plugin } from 'vite';

/**
 * Vite's HMR client has no reconnect logic: when the HMR WebSocket drops
 * (e.g. Caddy reloads its config and tears down the proxied connection), the
 * client polls the server and then does a full `location.reload()`. That makes
 * every open tab reload whenever Caddy restarts.
 *
 * This patches the dev client so that, on disconnect, it transparently
 * re-opens the HMR socket instead of reloading the page. Everything it needs
 * (`transport`, `createHMRHandler`, `handleMessage`) already lives at module
 * scope in Vite's client, so the change is a single statement swap.
 *
 * If the reconnect itself fails, the fresh socket's close handler runs the same
 * branch again, so it is self-healing.
 */
export default function hmrReconnectPlugin(): Plugin {
    return {
        name: 'stamhoofd:hmr-reconnect',
        apply: 'serve',
        transform(code, id) {
            if (!id.includes('vite/dist/client/client.mjs')) {
                return;
            }

            // Only the disconnect branch reloads right after a successful ping;
            // the other `location.reload()` calls (error overlay, debounced
            // full-reload) are intentionally left untouched.
            const patched = code.replace(
                /(await waitForSuccessfulPing\([^)]*\);\s*)location\.reload\(\);/,
                '$1console.log("[vite] reconnecting HMR socket…");'
                + 'transport.connect(createHMRHandler(handleMessage));',
            );

            if (patched === code) {
                this.warn('hmr-reconnect: could not find the reload branch in Vite\'s client — internals may have changed. Leaving it unpatched.');
                return;
            }

            return patched;
        },
    };
}
