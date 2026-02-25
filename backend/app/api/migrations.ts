import backendEnv from '@stamhoofd/backend-env';

backendEnv.load({ service: 'api' }).catch((error) => {
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
