import { deliverExceptionEnvelope, SimpleError } from '@common/errors';
import { fatalBackendException } from '@stamhoofd/backend-env';

import { configureNodeExceptions } from '@stamhoofd/backend-env/dist/exception-delivery.js';

const base = {
    dsn: 'https://fixture@fixture.eu-test.betterstackdata.com/123',
    release: 'a'.repeat(40),
    brand: 'fixture',
    environment: 'staging',
    service: 'api',
};
const owned = 'https://example.invalid/canary-deployment/assets/entry.js';
const lookup = (url) =>
    url === owned ? { id: '84ef940a-247c-421a-a31c-e65c08aa6254', lengths: [50, 50] } : undefined;
for (const config of [
    base,
    { ...base, brand: 'other' },
    { ...base, environment: 'production' },
    { ...base, release: 'b'.repeat(40) },
]) {
    configureNodeExceptions(config, config.dsn, lookup);
    for (const n of [1, 2]) {
        const defect = new TypeError('canary-member', { cause: new Error('canary-key') });
        defect.stack = `TypeError: canary-member\n at defect (${owned}:${n}:7)\n at other (https://example.invalid/?health=canary:1:1)`;
        await deliverExceptionEnvelope('backend.request', defect);
        await deliverExceptionEnvelope('backend.request', defect); // framework rethrow
    }
    await deliverExceptionEnvelope(
        'backend.request',
        new SimpleError({ code: 'canary', message: 'canary' }),
    );
}
fatalBackendException('rejection', new Error('canary-fatal'));
