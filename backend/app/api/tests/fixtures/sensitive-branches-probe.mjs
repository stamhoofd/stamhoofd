import '@stamhoofd/test-utils/environment';
import assert from 'node:assert/strict';
import { backendRecord, initializeBackendRecords } from '@node/logging';
import { EmailVerificationCode } from '@stamhoofd/models';
import { VerificationCodeService } from '../../dist/src/services/VerificationCodeService.js';
import { ContextInstance } from '../../dist/src/helpers/Context.js';
import { StripeHelper } from '../../dist/src/helpers/StripeHelper.js';
import { PatchOrganizationMembersEndpoint as Members } from '../../dist/src/endpoints/global/members/PatchOrganizationMembersEndpoint.js';
import { StripeWebookEndpoint } from '../../dist/src/endpoints/global/payments/StripeWebhookEndpoint.js';

initializeBackendRecords('api');
let lookups = 0;
EmailVerificationCode.where = async ({ token }) => {
    assert.match(token, /^canary-token-/);
    return ++lookups === 1 ? [] : [{ expiresAt: new Date(0), userId: 'not-to-be-loaded' }];
};
await VerificationCodeService.resend(null, 'canary-token-unknown');
await VerificationCodeService.resend(null, 'canary-token-expired');
assert.equal(lookups, 2);

const member = (label) => ({
    details: {
        firstName: 'Example',
        name: 'Example Member',
        age: 15,
        parents: [{ email: `canary-${label}@example.invalid` }],
    },
});
const duplicate = member('existing-parent');
Members.findExistingMember = async () => duplicate;
const denied = new Error('Access denied');
Members.checkCanAccessMember = async (value) => {
    assert.equal(value, duplicate);
    throw denied;
};
await ContextInstance.asyncLocalStorage.run(
    { auth: { hasSomePlatformAccess: () => true } },
    async () => {
        await assert.rejects(
            Members.checkDuplicate(member('submitted-parent'), null, 'put'),
            (e) => e === denied,
        );
    },
);

const { STAMHOOFD } = globalThis;
STAMHOOFD.STRIPE_SECRET_KEY = 'sk_test_fixture';
STAMHOOFD.STRIPE_ENDPOINT_SECRET = 'canary-signing-secret';
const endpoint = new StripeWebookEndpoint();
for (const type of ['charge.updated', 'account.updated', 'canary-unknown-event']) {
    const body = {
        type,
        id: 'canary-webhook-id',
        data: { object: { description: 'canary-payment' } },
    };
    const payload = JSON.stringify(body);
    const signature = StripeHelper.getInstance().webhooks.generateTestHeaderString({
        payload,
        secret: STAMHOOFD.STRIPE_ENDPOINT_SECRET,
    });
    const response = await endpoint.handle({
        body,
        headers: { 'stripe-signature': signature },
        request: { bodyPromise: Promise.resolve(payload) },
    });
    assert.equal(response.status, 200);
}
backendRecord('worker.failed'); // prove the dedicated sink was open throughout the probe
