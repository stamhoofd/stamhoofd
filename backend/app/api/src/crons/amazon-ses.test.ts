import { EmailAddress } from '@stamhoofd/email';
import { AuditLog } from '@stamhoofd/models';
import { randomUUID } from 'crypto';
import { handleBounce, handleComplaint, readHeaders } from './amazon-ses.js';

describe('SES header dictionary isolation', () => {
    test('retains special names as literal string headers', () => {
        const headers = readHeaders({
            mail: {
                headers: [
                    { name: '__proto__', value: 'first' },
                    { name: 'constructor', value: 'second' },
                    { name: 'prototype', value: 'third' },
                ],
            },
        });
        const get = (name: string) => headers.get(name);
        expect(get('__proto__')).toBe('first');
        expect(get('constructor')).toBe('second');
        expect(get('prototype')).toBe('third');
    });

    test('invalid object header values cannot supply inherited recipient identifiers', () => {
        const headers = readHeaders({
            mail: {
                headers: [
                    {
                        name: '__proto__',
                        value: { 'x-email-id': 'forged', 'x-email-recipient-id': 'forged' },
                    },
                ],
            },
        });
        const get = (name: string) => headers.get(name);
        expect(get('x-email-id')).toBeUndefined();
        expect(get('x-email-recipient-id')).toBeUndefined();
    });
});

describe('SES header normalization', () => {
    test('normalizes case and retains the last nonempty string header', () => {
        const headers = readHeaders({
            mail: {
                headers: [
                    { name: 'X-Email-Id', value: 'first' },
                    { name: 'x-email-id', value: 'last' },
                    { name: 'X-Empty', value: '' },
                    { name: '', value: 'ignored' },
                    { name: 'X-Invalid', value: 42 },
                    null,
                ],
            },
        });
        expect(headers).toEqual(new Map([['x-email-id', 'last']]));
    });

    test('returns independent empty Maps for missing or malformed header containers', () => {
        const first = readHeaders({});
        expect(first).toEqual(new Map());
        expect(readHeaders({ mail: { headers: 'invalid' } })).toEqual(new Map());
        expect(readHeaders(null)).toEqual(new Map());
        expect(readHeaders({})).not.toBe(first);
    });
});

describe('SES recipient email addresses', () => {
    function bounce(emailAddress: string) {
        const feedbackId = randomUUID();
        return {
            feedbackId,
            message: {
                notificationType: 'Bounce',
                bounce: {
                    feedbackId,
                    bounceType: 'Permanent',
                    bounceSubType: 'General',
                    bouncedRecipients: [{ emailAddress }],
                },
                mail: {},
            },
        };
    }

    test.each([
        ['a plain name', 'John Doe <', '>'],
        ['an encoded name', '=?UTF-8?Q?Zo=C3=AB_Janssens?= <', '>'],
        ['no name', '', ''],
    ])('a bounce with %s blocks and logs the plain email address', async (_, prefix, suffix) => {
        const email = 'bounce-' + randomUUID() + '@example.com';
        const { feedbackId, message } = bounce(prefix + email + suffix);

        await handleBounce(message);

        const emailAddress = await EmailAddress.getWhereHardBounceOrSpam(email);
        expect(emailAddress?.email).toBe(email);

        const log = await AuditLog.select()
            .where('externalId', 'aws-ses-message-' + feedbackId)
            .first(true);
        expect(log.objectId).toBe(email);
    });

    test('a bounce with multiple email addresses keeps the reported value', async () => {
        const reported =
            'first-' + randomUUID() + '@example.com, second-' + randomUUID() + '@example.com';

        await handleBounce(bounce(reported).message);

        const emailAddress = await EmailAddress.getWhereHardBounceOrSpam(reported);
        expect(emailAddress?.email).toBe(reported);
    });

    test('a complaint with a name marks the plain email address as spam', async () => {
        const email = 'complaint-' + randomUUID() + '@example.com';

        await handleComplaint({
            notificationType: 'Complaint',
            complaint: {
                feedbackId: randomUUID(),
                complaintFeedbackType: 'abuse',
                complainedRecipients: [{ emailAddress: 'John Doe <' + email + '>' }],
            },
            mail: {},
        });

        const emailAddress = await EmailAddress.getWhereHardBounceOrSpam(email);
        expect(emailAddress?.markedAsSpam).toBe(true);
    });
});
