import type { NuxtModule } from '@nuxt/schema';
import { createDevEmitter } from './events.js';

/**
 * Registers Nuxt's explicit development build and listener lifecycle callbacks.
 * @param _options - Nuxt module options (unused).
 * @param nuxt - Instance owning the hooks and cleanup.
 * @remarks Ready requires build:done, Nitro compilation and listen. This describes server
 * startup, not completion of every on-demand browser transform. No production events.
 */
export const devLifecycleModule: NuxtModule = (_options, nuxt) => {
    if (!nuxt.options.dev || !process.env.STAM_DEV_SOCKET) return;
    const emitter = createDevEmitter('docs');
    let listening = false;
    let built = false;
    let serverBuilt = false;
    let cycleId: string | undefined;
    const ready = () => { if (listening && built && serverBuilt) emitter.emit('ready'); };
    emitter.emit('starting');
    nuxt.hook('build:before', () => {
        built = false;
        cycleId = process.hrtime.bigint().toString();
        emitter.emit('build.started', { cycleId });
    });
    nuxt.hook('build:done', () => {
        built = true;
        if (cycleId) emitter.emit('build.succeeded', { cycleId });
        ready();
    });
    nuxt.hook('build:error', () => {
        built = false;
        if (cycleId) emitter.emit('build.failed', { cycleId });
    });
    nuxt.hook('listen', () => { listening = true; ready(); });
    nuxt.hook('nitro:init', (nitro) => {
        let serverCycle: string | undefined;
        nitro.hooks.hook('dev:start', () => {
            serverBuilt = false;
            serverCycle = process.hrtime.bigint().toString();
            emitter.emit('build.started', { cycleId: serverCycle });
        });
        nitro.hooks.hook('dev:reload', () => {
            serverBuilt = true;
            if (serverCycle) emitter.emit('build.succeeded', { cycleId: serverCycle });
            ready();
        });
        nitro.hooks.hook('dev:error', () => {
            serverBuilt = false;
            if (serverCycle) emitter.emit('build.failed', { cycleId: serverCycle });
        });
    });
    nuxt.hook('close', () => emitter.close());
};
