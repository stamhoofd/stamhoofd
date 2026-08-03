import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { EmailTemplateFactory, OrganizationFactory, PasswordToken, UserFactory } from '@stamhoofd/models';
import { EmailTemplateType } from '@stamhoofd/structures';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { ForgotPasswordEndpoint } from './ForgotPasswordEndpoint.js';

const endpoint = new ForgotPasswordEndpoint();

describe('Endpoint.ForgotPassword', () => {
    beforeEach(async () => {
        await new EmailTemplateFactory({ type: EmailTemplateType.ForgotPassword }).create();
        await new EmailTemplateFactory({ type: EmailTemplateType.ForgotPasswordButNoAccount }).create();
    });

    function request(host: string, email: string) {
        return Request.buildJson('POST', '/forgot-password', host, { email });
    }

    test('the recovery link is emailed to the stored address, not the one that was typed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, password: 'test-password-1234' }).create();

        await testServer.test(endpoint, request(organization.getApiHost(), user.email.toUpperCase()));

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].to).toContain(user.email);

        const [passwordToken] = await PasswordToken.select().where('userId', user.id).fetch();
        expect(passwordToken).toBeDefined();
        expect(emails[0].html).toContain(encodeURIComponent(passwordToken.token));
    });

    test('an unknown address still gets an email, so it does not leak who has an account', async () => {
        const organization = await new OrganizationFactory({}).create();

        await testServer.test(endpoint, request(organization.getApiHost(), 'nobody@example.com'));

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].to).toContain('nobody@example.com');
    });
});
