import type { Plugin, ViteDevServer } from 'vite';
import type { DevApp } from './events.js';
import { createDevEmitter } from './events.js';

/**
 * Reports Vite server availability without pretending lazy transforms are a full build.
 * @param app - Owner selected by the calling config.
 * @returns A development-only plugin; no work in production builds.
 * @remarks The supervisor supplies the process identity. A config reload starts
 * another startup phase within that identity; the supervisor reports actual exits.
 */
export function devLifecyclePlugin(app: DevApp) {
    let emitter: ReturnType<typeof createDevEmitter> | undefined;
    return {
        name: 'stam-dev-lifecycle',
        apply: 'serve',
        configureServer(server: Pick<ViteDevServer, 'httpServer'>) {
            emitter = createDevEmitter(app);
            emitter.emit('starting');
            const ready = () => emitter?.emit('ready');
            if (server.httpServer?.listening) ready();
            else server.httpServer?.once('listening', ready);
            server.httpServer?.once('close', () => { void emitter?.close(); });
        },
        async closeBundle() {
            await emitter?.close();
        },
    } satisfies Plugin;
}
