import backendEnv from '@stamhoofd/backend-env';
import { BackendApp } from '@stamhoofd/types/BackendApp';
import { runApplication } from '@node/observability';

process.title = 'stamhoofd-renderer';
runApplication('renderer', async (lifecycle) => {
    await backendEnv.load({ service: BackendApp.Renderer });
    const { boot } = await import('./boot.js');
    await boot(lifecycle);
}).catch((error) => {
    console.error('Failed to start the renderer:', error);
    process.exit(1);
});
