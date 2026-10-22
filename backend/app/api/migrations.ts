import backendEnv from '@stamhoofd/backend-env';
import { BackendApp } from '@stamhoofd/types/BackendApp';

backendEnv.load({ service: BackendApp.Api }).catch((error) => {
    console.error('Failed to load environment:', error);
    process.exit(1);
}).then(async () => {
    const { run } = await import('./src/migrate.js');
    await run();
    process.exit(0);
}).catch((error) => {
    console.error('Failed to run migrations:', error);
    process.exit(1);
});
