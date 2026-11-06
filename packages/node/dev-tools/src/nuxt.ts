import type { NuxtModule } from '@nuxt/schema';
import { createDevEmitter } from './events.js';

/**
 * Registers Nuxt's explicit development build and listener lifecycle callbacks.
 * @param options - Optional application lifecycle owner. When supplied, ready and
 * close are delegated to it; build events still use the development emitter.
 * @param nuxt - Instance owning the hooks and cleanup.
 * @remarks Ready requires build:done, Nitro compilation and listen. This describes server
 * startup, not completion of every on-demand browser transform. No production events.
 * Uses the supervisor's STAM_DEV_* environment through createDevEmitter. Nuxt's
 * close hook drains the emitter; the supervisor reports process exit. No cwd assumptions.
 */
export const devLifecycleModule: NuxtModule<{ lifecycle?: { ready(): Promise<void>; failed(): void; close(): Promise<void> } }> = (options, nuxt) => {
    if (!nuxt.options.dev) return;
    const emitter = createDevEmitter('docs');
    let listening = false;
    let built = false;
    let serverBuilt = false;
    let cycleId: string | undefined;
    const ready = async () => {
        if (listening && built && serverBuilt) {
            if (options.lifecycle) await options.lifecycle.ready();
            else emitter.emit('ready');
        }
    };
    emitter.emit('starting');
    nuxt.hook('build:before', () => {
        built = false;
        cycleId = process.hrtime.bigint().toString();
        emitter.emit('build.started', { cycleId });
    });
    nuxt.hook('build:done', async () => {
        built = true;
        if (cycleId) emitter.emit('build.succeeded', { cycleId });
        await ready();
    });
    nuxt.hook('build:error', () => {
        built = false;
        if (cycleId) emitter.emit('build.failed', { cycleId });
    });
    nuxt.hook('listen', async () => { listening = true; await ready(); });
    nuxt.hook('nitro:init', (nitro) => {
        let serverCycle: string | undefined;
        nitro.hooks.hook('dev:start', () => {
            serverBuilt = false;
            serverCycle = process.hrtime.bigint().toString();
            emitter.emit('build.started', { cycleId: serverCycle });
        });
        nitro.hooks.hook('dev:reload', async () => {
            serverBuilt = true;
            if (serverCycle) emitter.emit('build.succeeded', { cycleId: serverCycle });
            await ready();
        });
        nitro.hooks.hook('dev:error', () => {
            serverBuilt = false;
            if (serverCycle) emitter.emit('build.failed', { cycleId: serverCycle });
        });
    });
    nuxt.hook('close', async () => {
        await options.lifecycle?.close();
        await emitter.close();
    });
};
