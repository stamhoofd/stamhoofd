import '@stamhoofd/test-utils/environment';
import assert from 'node:assert/strict';
import nock from 'nock';
import { backendRecord, initializeBackendRecords } from '@node/logging';
import { Email as Mailer, EmailAddress } from '@stamhoofd/email';
import { Email, EmailRecipient, PayconiqPayment, Payment, Platform, User } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import {
    EmailRecipientsStatus,
    PaymentProvider,
    PaymentStatus,
    Replacement,
} from '@stamhoofd/structures';
import { EmailSendService } from '../../dist/src/services/EmailSendService.js';
import { PaymentService } from '../../dist/src/services/PaymentService.js';
import { FileSignService } from '../../dist/src/services/FileSignService.js';
import { StripeHelper } from '../../dist/src/helpers/StripeHelper.js';

nock.disableNetConnect();
initializeBackendRecords('api');
const address = 'canary-recipient@example.invalid';
const { STAMHOOFD } = globalThis;
await FileSignService.load(); // missing keys in test mode: signing stays disabled

const org = { id: 'org', privateMeta: { payconiqApiKey: 'canary-provider-key' } };
const payment = {
    id: '4743e3d6-1690-41d9-aba5-f7e13735ae47',
    provider: PaymentProvider.Stripe,
    status: PaymentStatus.Pending,
    createdAt: new Date(),
    organizationId: org.id,
    price: 987654321,
};
Payment.getByID = async () => payment;
let polled = false;
StripeHelper.getStatus = async () => {
    polled = true;
    throw new Error('canary-provider-error');
};
assert.equal(await PaymentService.pollStatus(payment.id, org), payment);
assert.ok(polled);
const provider = nock('https://merchant.api.preprod.bancontact.net')
    .get('/v3/payments/canary-reference')
    .reply(200, { status: 'SUCCEEDED', amount: 1234567 }, { 'x-probe': 'canary-provider-header' });
const payconiq = new PayconiqPayment();
payconiq.payconiqId = 'canary-reference';
assert.equal(await payconiq.getStatus(org, payment), PaymentStatus.Failed);
provider.done();

const rows = [];
const email = {
    id: 'email',
    save: async () => {},
    getCombinedHtml: () => '{{custom}}',
    recipientFilter: { filters: [{ type: 'fixture' }] },
    getLanguages: () => null,
    getFromAddress: () => null,
};
Email.getByID = async () => email;
Platform.getForTenant = async () => ({});
Platform.getSharedPrivateStruct = async () => ({ config: { getEmailReplacements: () => [] } });
User.getForAuthentication = async () => null;
SQL.delete = () => ({ from: () => ({ where: async () => {} }) });
EmailRecipient.prototype.save = async function () {
    if (!rows.includes(this)) {
        this.id = `recipient-${rows.length}`;
        rows.push(this);
    }
};
EmailRecipient.select = () => ({
    where() {
        return this;
    },
    fetch: async () => rows.filter((r) => !r.duplicateOfRecipientId),
});
Email.recipientLoaders.set('fixture', {
    fetch: async () => ({
        results: ['one', 'two', 'one'].map((label) => ({
            email: address,
            firstName: 'Test',
            lastName: 'Member',
            replacements: [
                Replacement.create({ token: 'custom', value: `canary-replacement-${label}` }),
            ],
        })),
    }),
});
await EmailSendService.buildRecipients(email);
assert.equal(email.recipientsStatus, EmailRecipientsStatus.Created);
assert.equal(email.emailRecipientsCount, 2);
assert.equal(rows[2].duplicateOfRecipientId, rows[0].id);

// Run the actual delivery and terminal-failure paths using only an in-memory transport.
STAMHOOFD.environment = 'development';
STAMHOOFD.WHITELISTED_EMAIL_DESTINATIONS = ['*'];
EmailAddress.filterSendTo = async (recipients) => recipients;
const failure = new Error('canary-smtp-credential');
for (const expected of [null, failure]) {
    let delivered = false;
    Mailer.transporter = {
        async sendMail(mail) {
            assert.equal(mail.to, address);
            assert.equal(mail.text, 'canary-body');
            assert.equal(mail.headers['X-Fixture'], 'canary-header-credential');
            delivered = true;
            if (expected) throw expected;
            return { messageId: 'canary-message-id' };
        },
    };
    let result;
    await Mailer.doSend({
        from: { email: 'sender@example.invalid' },
        to: [{ email: address }],
        subject: 'canary-subject',
        text: 'canary-body',
        retryCount: 2,
        headers: new Map([['X-Fixture', 'canary-header-credential']]),
        callback(error) {
            result = error;
        },
    });
    assert.ok(delivered);
    assert.equal(result, expected);
}
backendRecord('worker.failed');
