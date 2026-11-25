import assert from 'node:assert/strict';
import { once } from 'node:events';
import { SimpleError, SimpleErrors } from '@common/errors';
import { Router, RouterServer } from '@node/endpoints';

const router = new Router();
const error = Object.assign(
    new TypeError('canary-member', { cause: new Error('canary-credential') }),
    {
        stack: 'at canary-payment (/private/canary-member.js:8:9)',
        attachments: ['canary-attachment'],
    },
);
const expected = new SimpleError({ code: 'invalid', message: 'canary-typed', statusCode: 422 });
const errors = [expected, new SimpleErrors(expected), error];
router.endpoints.push({
    decode() {
        throw errors.shift();
    },
});
const server = new RouterServer(router);
server.listen(0);
await once(server.server, 'listening');
try {
    for (const status of [422, 422, 500]) {
        const res = await fetch(
            `http://127.0.0.1:${server.server.address().port}/v1/canary-route?health=canary-key`,
            {
                method: 'POST',
                headers: { authorization: 'Bearer canary', cookie: 'canary-member' },
                body: 'canary-body',
            },
        );
        assert.equal(res.status, status);
        assert.match(await res.text(), status === 500 ? /internal_error/ : /canary-typed/);
    }
} finally {
    await server.close();
}
