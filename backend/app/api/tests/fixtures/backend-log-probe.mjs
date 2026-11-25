import '@stamhoofd/test-utils/environment';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { backendRecord, initializeBackendRecords } from '@node/logging';
import { Database } from '@node/database';
import { DecodedRequest, Router, RouterServer } from '@node/endpoints';
import { SQLSelect, SQLLogger } from '@stamhoofd/sql';
import { LogMiddleware } from '@stamhoofd/backend-middleware';

initializeBackendRecords('api');
const router = new Router();
const server = new RouterServer(router);
server.verbose = true;
server.addRequestMiddleware(LogMiddleware);
server.addResponseMiddleware(LogMiddleware);
server.addResponseMiddleware({
    handleResponse() {
        throw new Error('canary-member');
    },
});
router.endpoints.push({
    async decode(req) {
        await DecodedRequest.fromRequest(req, {}, undefined, { decode: (data) => data });
        // Successful decoding is followed by a driver failure, without connecting to MySQL.
        Database.select = async () => {
            throw Object.assign(new Error('canary-driver: canary-payment'), {
                code: 'ER_LOCK_DEADLOCK',
            });
        };
        await new SQLSelect('id').from('canary_table').where('id', 'canary-member').log().fetch();
    },
});
server.listen(0);
await once(server.server, 'listening');
try {
    const url = `http://127.0.0.1:${server.server.address().port}/v1/canary-path?key=canary-health`;
    for (const [body, code] of [
        ['{"canary-malformed"', 400],
        ['{"member":"canary-member","payment":"canary-payment"}', 500],
    ]) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { authorization: 'Bearer canary-token', cookie: 'canary-cookie' },
            body,
        });
        assert.equal(res.status, code);
        await res.text();
    }
} finally {
    await server.close();
}
SQLLogger.slowQueryThresholdMs = -1;
await SQLLogger.log(Promise.resolve(), 'SELECT canary_sql', ['canary-payment']);
backendRecord('canary-event', 'canary-method', 1234567);
backendRecord('http.response', 'canary-method', 502, Infinity);
const stringify = JSON.stringify;
try {
    JSON.stringify = () => {
        throw new Error('canary-transform-error');
    };
    backendRecord('application.unhandled');
} finally {
    JSON.stringify = stringify;
}

// Mixed PM2 streams are not a trusted source, even if text looks exactly like a record.
process.stdout.write('{"event":"worker.failed","untrusted":"local-only-direct-write"}\n');
spawnSync(process.execPath, ['-e', 'console.error("local-only-child-output")'], {
    stdio: 'inherit',
});
