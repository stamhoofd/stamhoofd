import backendEnv from '@stamhoofd/backend-env';

process.title = 'stamhoofd-backup';
backendEnv.load({ service: 'backup' }).catch((error) => {
    console.error('Failed to load environment:', error);
    process.exit(1);
}).then(async () => {
    await import('./src/boot.js');
}).catch((error) => {
    console.error('Failed to start the API:', error);
    process.exit(1);
});
