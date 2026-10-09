import type { MailchimpMocker } from '../../../tests/helpers/MailchimpMocker.js';
import { initMailchimpApi } from '../../../tests/init/initMailchimpApi.js';
import { MailchimpApiError, MailchimpClient } from './MailchimpClient.js';

describe('MailchimpClient', () => {
    let mailchimp: MailchimpMocker;
    let client: MailchimpClient;

    beforeEach(() => {
        mailchimp = initMailchimpApi();
        client = new MailchimpClient(mailchimp.apiKey);
    });

    afterEach(() => {
        MailchimpClient.retryDelay = 1000;
        MailchimpClient.maxRetryAfterSeconds = 60;
    });

    test('pages through the audience and includes archived contacts', async () => {
        const members = Array.from({ length: 2500 }, (_, i) => ({ email: `member${i}@example.com` }));
        const archived = Array.from({ length: 500 }, (_, i) => ({ email: `archived${i}@example.com`, status: 'archived' }));
        mailchimp.addList('list1', 'Audience', [...members, ...archived]);

        const result = await client.getMembers('list1');

        expect(result.size).toBe(3000);
        expect(result.get('member2499@example.com')?.status).toBe('subscribed');
        expect(result.get('archived499@example.com')?.status).toBe('archived');
        // 3 pages of 1000 and 1 page of archived contacts
        expect(mailchimp.requests.filter(r => r.method === 'GET').length).toBe(4);
    });

    test('retries after a 429 with a capped Retry-After and gives up on persistent errors', async () => {
        mailchimp.addList('list1', 'Audience');
        MailchimpClient.retryDelay = 1;
        MailchimpClient.maxRetryAfterSeconds = 0.01;

        // Would wait an hour without the cap and fail the test timeout
        mailchimp.forcedResponses.push({ status: 429, body: { title: 'Too Many Requests', detail: 'Slow down' }, headers: { 'Retry-After': '3600' } });
        mailchimp.forcedResponses.push({ status: 503, body: { title: 'Service Unavailable', detail: 'Try again' } });
        const lists = await client.getLists();
        expect(lists.map(l => l.id)).toEqual(['list1']);
        expect(mailchimp.requests.length).toBe(3);

        for (let i = 0; i < 6; i++) {
            mailchimp.forcedResponses.push({ status: 500, body: { title: 'Internal Server Error', detail: 'Boom' } });
        }
        await expect(client.getLists()).rejects.toThrow(MailchimpApiError);
        expect(mailchimp.forcedResponses.length).toBe(0);
    });
});
