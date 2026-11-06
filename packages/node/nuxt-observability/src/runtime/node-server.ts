import '#nitro-internal-pollyfills';
import { createServer } from 'node:http';
import { runApplication } from '@node/observability';

// Nitro's standard node entry does not expose its listener to runtime plugins.
// Own only the Node listener; reuse Nitro's router and graceful-shutdown machinery.
runApplication('docs', async (lifecycle) => {
    const { useNitroApp } = await import('nitropack/runtime');
    const { setupGracefulShutdown, trapUnhandledNodeErrors } = await import('nitropack/runtime/internal/index');
    const { toNodeListener } = await import('h3');
    const app = useNitroApp();
    const server = createServer(toNodeListener(app.h3App));
    app.hooks.hook('close', () => lifecycle.close());
    const port = Number(process.env.NITRO_PORT || process.env.PORT || 3000);
    server.listen(port, process.env.NITRO_HOST || process.env.HOST || '0.0.0.0');
    setupGracefulShutdown(server, app);
    trapUnhandledNodeErrors();
    await lifecycle.ready(server);
}).catch(() => {
    console.error('Docs server initialization failed.');
    process.exit(1);
});
