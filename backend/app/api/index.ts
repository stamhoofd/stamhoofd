import backendEnv from '@stamhoofd/backend-env';

backendEnv.load({ service: 'api' }).catch((error) => {
    console.error('Failed to load environment:', error);
    process.exit(1);
}).then(async () => {
    if (STAMHOOFD.environment === 'development') {
        const { run } = await import('./src/migrate.js');
        await run();
    }
    const { boot } = await import('./src/boot.js');

    boot({ killProcess: true }).catch((error) => {
        console.error('unhandledRejection', error);
        process.exit(1);
    });
}).catch((error) => {
    console.error('Failed to start the API:', error);
    process.exit(1);
});
