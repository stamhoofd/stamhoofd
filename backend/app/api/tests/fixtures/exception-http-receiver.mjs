import { writeSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import nock from 'nock';

// Intercept the final HTTP request, including serialization and auth; no socket can reach a provider.
nock.disableNetConnect();
nock('https://fixture.eu-test.betterstackdata.com')
    .persist()
    .post('/api/123/envelope/')
    .query(true)
    .reply(async function (uri, body) {
        await setTimeout(40); // a fatal owner that exits immediately will lose this delivery
        writeSync(3, JSON.stringify({ uri, headers: this.req.headers, body }) + '\n');
        return [200, '{}'];
    });
