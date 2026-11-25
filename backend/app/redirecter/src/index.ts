import backendEnv, { fatalBackendException } from '@stamhoofd/backend-env';
import { BackendApp } from '@stamhoofd/types/BackendApp';

process.title = 'stamhoofd-redirecter';
backendEnv
    .load({ service: BackendApp.Redirecter })
    .then(async () => {
        await import('./boot.js');
    })
    .catch((error) => fatalBackendException('startup', error));
