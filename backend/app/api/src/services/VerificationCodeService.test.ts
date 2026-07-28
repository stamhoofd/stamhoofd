import { I18n } from '@stamhoofd/backend-i18n';
import { EmailMocker } from '@stamhoofd/email';
import { EmailTemplateFactory, EmailVerificationCode, OrganizationFactory, Platform, UserFactory } from '@stamhoofd/models';
import { EmailTemplateType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { VerificationCodeService } from './VerificationCodeService.js';

const i18n = new I18n(I18n.defaultLanguage, I18n.defaultCountry);

const PLATFORM_NAME = 'The test platform';

/**
 * A template that only contains the organizationName replacement, so the name that ends up in the
 * email can be asserted without depending on the real (translated) template contents.
 */
async function createVerifyEmailTemplate() {
    await new EmailTemplateFactory({
        type: EmailTemplateType.VerifyEmail,
        html: '<p>{{organizationName}}</p>',
        text: '{{organizationName}}',
    }).create();
}

describe('VerificationCodeService', () => {
    let originalPlatformName: string;

    beforeAll(async () => {
        const platform = await Platform.getForEditing();
        originalPlatformName = platform.config.name;
        platform.config.name = PLATFORM_NAME;
        await platform.save();
    });

    afterAll(async () => {
        const platform = await Platform.getForEditing();
        platform.config.name = originalPlatformName;
        await platform.save();
    });

    describe('send', () => {
        test('Uses the name of the organization when the code is scoped to an organization', async () => {
            TestUtils.setEnvironment('userMode', 'organization');
            await createVerifyEmailTemplate();

            const organization = await new OrganizationFactory({ name: 'Organization with a name' }).create();
            const user = await new UserFactory({ organization }).create();
            const code = await EmailVerificationCode.createFor(user, user.email);

            await VerificationCodeService.send(code, user, organization, i18n);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails.length).toBe(1);
            expect(emails[0].text).toContain('Organization with a name');
            expect(emails[0].text).not.toContain(PLATFORM_NAME);
        });

        test('Falls back to the name of the platform when there is no organization', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            await createVerifyEmailTemplate();

            const user = await new UserFactory({}).create();
            const code = await EmailVerificationCode.createFor(user, user.email);

            await VerificationCodeService.send(code, user, null, i18n);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails.length).toBe(1);
            expect(emails[0].text).toContain(PLATFORM_NAME);
        });
    });
});
