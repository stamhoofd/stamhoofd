import backendEnv from '@stamhoofd/backend-env';

process.title = 'stamhoofd-statistics-migrations';
backendEnv.load({ service: 'statistics' }).catch((error) => {
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
