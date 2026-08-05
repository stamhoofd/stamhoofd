import backendEnv from '@stamhoofd/backend-env';

process.title = 'stamhoofd-statistics-syncer';
backendEnv.load({ service: 'statistics-syncer' }).catch((error) => {
    console.error('Failed to load environment:', error);
    process.exit(1);
}).then(async () => {
    await import('./src/boot.js');
}).catch((error) => {
    console.error('Failed to start the statistics service:', error);
    process.exit(1);
});
