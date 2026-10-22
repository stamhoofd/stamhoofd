import backendEnv from '@stamhoofd/backend-env';
import { BackendApp } from '@stamhoofd/types/BackendApp';

process.title = 'stamhoofd-redirecter';
backendEnv.load({ service: BackendApp.Redirecter }).catch((error) => {
    console.error('Failed to load environment:', error);
    process.exit(1);
}).then(async () => {
    await import('./boot.js');
}).catch((error) => {
    console.error('Failed to start the API:', error);
    process.exit(1);
});
