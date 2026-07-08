import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization, Token, User } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { Token as TokenModel } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { Company } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import nock from 'nock';

import { resetNock } from '../../../../../tests/helpers/resetNock.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { initPlatformAdmin } from '../../../../../tests/init/initPlatformAdmin.js';
import { GetStripePayoutsExportStatusEndpoint } from './GetStripePayoutsExportStatusEndpoint.js';
import { StripePayoutsExportEndpoint } from './StripePayoutsExportEndpoint.js';

describe('Endpoint.StripePayoutsExport', () => {
    const endpoint = new StripePayoutsExportEndpoint();
    const statusEndpoint = new GetStripePayoutsExportStatusEndpoint();

    let membershipOrganization: Organization;
    let admin: User;
    let adminToken: Token;

    beforeAll(async () => {
        membershipOrganization = await initMembershipOrganization();
        membershipOrganization.meta.companies = [
            Company.create({
                name: 'Platform BV',
                companyNumber: '0700000000',
                VATNumber: 'BE0700000000',
            }),
        ];
        await membershipOrganization.save();

        ({ admin, adminToken } = await initPlatformAdmin());
    });

    afterEach(() => {
        resetNock();
    });

    const post = async (organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', '/stripe/payouts', organization.getApiHost(), {
            start: new Date(2026, 2, 1).getTime(),
            end: new Date(2026, 3, 1).getTime() - 1000,
        });
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const getStatus = async (organization: Organization, token: Token) => {
        const request = Request.buildJson('GET', '/stripe/payouts/status', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(statusEndpoint, request);
    };

    test('A platform admin can export payout reports for the membership organization', async () => {
        nock('https://api.stripe.com')
            .get('/v1/payouts')
            .query(true)
            .reply(200, { object: 'list', data: [], has_more: false, url: '/v1/payouts' });

        const response = await post(membershipOrganization, adminToken);
        expect(response.status).toBe(200);

        // Wait for the scheduled report to complete
        await QueueHandler.awaitAll();

        const emails = await EmailMocker.transactional.getSucceededEmails();
        const reportEmail = emails.find(e => e.subject.startsWith('Stripe Uitbetalingen'));
        expect(reportEmail).toBeDefined();
        expect(reportEmail!.attachments).toHaveLength(1);

        // The report is sent to the user that requested it
        expect(reportEmail!.to).toContain(admin.email);

        // The queue is empty again
        const statusResponse = await getStatus(membershipOrganization, adminToken);
        expect(statusResponse.body).toEqual([]);
    });

    test('A user without platform full access cannot export payout reports', async () => {
        const user = await new UserFactory({ organization: membershipOrganization }).create();
        const token = await TokenModel.createToken(user);

        await expect(post(membershipOrganization, token)).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
        await expect(getStatus(membershipOrganization, token)).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('Payout reports are not available for other organizations', async () => {
        const otherOrganization = await new OrganizationFactory({}).create();

        await expect(post(otherOrganization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'not_available' }),
        );
    });
});
