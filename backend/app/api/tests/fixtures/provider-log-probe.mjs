import '@stamhoofd/test-utils/environment';
import assert from 'node:assert/strict';
import nock from 'nock';
import { Database } from '@node/database';
import { backendRecord, initializeBackendRecords } from '@node/logging';
import { BuckarooPayment, MollieToken } from '@stamhoofd/models';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { BuckarooHelper } from '../../dist/src/helpers/BuckarooHelper.js';

nock.disableNetConnect();
initializeBackendRecords('api');
const mollie = nock('https://api.mollie.com')
    .post('/oauth2/tokens', 'grant_type=refresh_token&refresh_token=canary-old-refresh')
    .reply(
        200,
        { access_token: 'canary-rotated-access', refresh_token: 'canary-rotated-refresh' },
        { 'x-probe': 'canary-header' },
    )
    .get('/v2/canary-resource')
    .matchHeader('authorization', 'Bearer canary-rotated-access')
    .reply(400, { detail: 'canary-upstream-json' })
    .get('/v2/canary-resource')
    .reply(503, 'canary-upstream-text');
try {
    const [token] = await MollieToken.where({ organizationId: process.argv[2] });
    await token.refresh();
    await assert.rejects(
        token.authRequest('GET', '/v2/canary-resource'),
        (e) => e.body.detail === 'canary-upstream-json',
    );
    await assert.rejects(token.authRequest('GET', '/v2/canary-resource'), /canary-upstream-text/);
    mollie.done();
} finally {
    await Database.end();
}

const helper = new BuckarooHelper('canary-merchant', 'canary-secret', true);
const pay = { id: 'canary-invoice', method: PaymentMethod.iDEAL, price: 73456700 };
const returnUrl = 'https://example.invalid/canary-return';
const pushUrl = 'https://example.invalid/canary-push';
const buckaroo = nock('https://testcheckout.buckaroo.nl')
    .matchHeader('authorization', /^hmac canary-merchant:/)
    .post('/json/Transaction', {
        Currency: 'EUR',
        AmountDebit: '7345.67',
        Invoice: 'ID canary-invoice',
        ClientIP: { Type: 0, Address: '192.0.2.77' },
        Services: { ServiceList: [{ Name: 'ideal', Action: 'Pay', Parameters: [] }] },
        ContinueOnIncomplete: '1',
        Description: 'canary-description',
        PushURL: pushUrl,
        PushURLFailure: pushUrl,
        ReturnURL: returnUrl,
        ReturnURLCancel: returnUrl,
        ReturnURLError: returnUrl,
        ReturnURLReject: returnUrl,
    })
    .reply(200, {
        Key: 'canary-transaction',
        Status: { Code: { Code: 'canary-unknown' } },
        RequiredAction: { RedirectURL: returnUrl },
    })
    .post('/json/Transaction')
    .reply(500, { detail: 'canary-upstream-error' });
let saved = false;
BuckarooPayment.prototype.save = async function () {
    assert.equal(this.transactionKey, 'canary-transaction');
    assert.equal(this.paymentId, pay.id);
    saved = true;
};
assert.equal(
    await helper.createPayment(pay, '192.0.2.77', 'canary-description', returnUrl, pushUrl),
    returnUrl,
);
assert.equal(pay.status, PaymentStatus.Pending);
assert.ok(saved);
assert.equal(await helper.createTest(), false);
buckaroo.done();
backendRecord('worker.failed');
