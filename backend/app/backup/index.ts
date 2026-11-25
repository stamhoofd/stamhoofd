import backendEnv, { fatalBackendException } from '@stamhoofd/backend-env';
import { BackendApp } from '@stamhoofd/types/BackendApp';

process.title = 'stamhoofd-backup';
backendEnv
    .load({ service: BackendApp.Backup })
    .then(async () => {
        await import('./src/boot.js');
    })
    .catch((error) => fatalBackendException('startup', error));
