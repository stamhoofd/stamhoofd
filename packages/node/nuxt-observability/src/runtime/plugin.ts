import type { NitroApp } from 'nitropack/types';
import { initializeTelemetry, observeRequest } from '@node/observability';

declare global {
    interface ImportMeta { prerender?: boolean; dev?: boolean }
}

/** Captures fixed server fields only; request content and error objects are never exported. */
export default function telemetryPlugin(app: NitroApp): void {
    if (import.meta.prerender) return;
    const telemetry = initializeTelemetry('docs');
    // Production entry owns lifecycle.close before SDK shutdown; dev workers only own requests.
    if (import.meta.dev) app.hooks.hook('close', () => telemetry.shutdown());
    app.hooks.hook('request', (event) => {
        const request = observeRequest(event.method);
        event.node.res.once('finish', () => {
            const route: unknown = event.context.matchedRoute?.path;
            request.finish(event.node.res.statusCode, typeof route === 'string' ? route : undefined);
        });
        event.node.res.once('close', () => request.finish(event.node.res.statusCode));
    });
}
