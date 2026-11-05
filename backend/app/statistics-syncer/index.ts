import backendEnv from '@stamhoofd/backend-env';
import { BackendApp } from '@stamhoofd/types/BackendApp';
import { runApplication } from '@node/observability';

process.title = 'stamhoofd-statistics-syncer';
runApplication('stats', async (lifecycle) => {
    await backendEnv.load({ service: BackendApp.StatisticsSyncer });
    if (STAMHOOFD.environment === 'development') {
        const { run } = await import('./src/migrate.js');
        await run();
    }
    const { boot } = await import('./src/boot.js');

    await boot({ killProcess: true, lifecycle });
}).catch((error) => {
    console.error('Failed to start the statistics service:', error);
    process.exit(1);
});
