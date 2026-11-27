import type { NuxtModule } from '@nuxt/schema';
import type { NitroOptions } from 'nitropack/types';
import { fileURLToPath } from 'node:url';
import { devLifecycleModule } from '@node/dev-tools/nuxt';
import { ApplicationLifecycle, initializeTelemetry } from '@node/observability';

/** Node-server instrumentation shared by Nuxt development and production runtime. */
const module: NuxtModule = async (_options, nuxt) => {
    nuxt.hook('nitro:config', (config) => {
        config.plugins ??= [];
        config.plugins.push(fileURLToPath(new URL('./runtime/plugin.js', import.meta.url)));
    });
    nuxt.hook('nitro:init', (nitro) => {
        // Keep _config intact: Nitro copies it to construct its separate prerender runtime.
        if (!nuxt.options.dev) (nitro.options as NitroOptions).entry = fileURLToPath(new URL('./runtime/node-server.js', import.meta.url));
    });
    if (nuxt.options.dev) {
        // Only Nitro's request-serving worker owns the metrics listener in development.
        const telemetry = initializeTelemetry('docs', { ownsMetrics: false });
        const lifecycle = new ApplicationLifecycle('docs', () => telemetry.shutdown());
        await devLifecycleModule({ lifecycle }, nuxt);
    }
};

export default module;
