import type { MailchimpAudience } from '@stamhoofd/structures/mailchimp/MailchimpAudience.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import type { MailchimpMocker } from '../../../../../tests/helpers/MailchimpMocker.js';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { connectMailchimp, initMailchimpOrganization, mailchimpRequest } from '../../../../../tests/init/initMailchimpOrganization.js';
import { GetMailchimpAudiencesEndpoint } from './GetMailchimpAudiencesEndpoint.js';

describe('Endpoint.GetMailchimpAudiences', () => {
    const endpoint = new GetMailchimpAudiencesEndpoint();
    let mailchimp: MailchimpMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mailchimp = initMailchimpApi();
    });

    test('lists the audiences of the connected account', async () => {
        mailchimp.addList('list1', 'Nieuwsbrief Scouts Gent', [{ email: 'a@example.com' }, { email: 'b@example.com' }]);
        mailchimp.addList('list2', 'Oud-leiding');
        const context = await initMailchimpOrganization();

        await expect(mailchimpRequest(endpoint, 'GET', '/mailchimp/audiences', context.host, context.token))
            .rejects.toThrow(STExpect.simpleError({ code: 'mailchimp_not_connected' }));

        await connectMailchimp(mailchimp, context);
        const response = await mailchimpRequest<MailchimpAudience[]>(endpoint, 'GET', '/mailchimp/audiences', context.host, context.token);
        expect(response.body.map(a => [a.id, a.name, a.memberCount])).toEqual([
            ['list1', 'Nieuwsbrief Scouts Gent', 2],
            ['list2', 'Oud-leiding', 0],
        ]);
    });
});
