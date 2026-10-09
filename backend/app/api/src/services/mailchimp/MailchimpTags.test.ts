import { OrganizationFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import { MailchimpTags } from './MailchimpTags.js';

describe('MailchimpTags', () => {
    test('uses the language of the organization, not of the request', async () => {
        TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French] });
        const organization = await new OrganizationFactory({}).create();
        organization.language = Language.French;

        const tags = await MailchimpTags.forScope(organization);
        expect(tags.i18n.language).toBe(Language.French);
    });

    test('order tags are never member tags', async () => {
        const tags = await MailchimpTags.forScope(null);

        expect(tags.isMemberTag(tags.member)).toBe(true);
        expect(tags.isMemberTag(tags.group('Welpen'))).toBe(true);
        expect(tags.isMemberTag(tags.customer)).toBe(false);
        expect(tags.isMemberTag(tags.webshop('Wafelbak'))).toBe(false);
        expect(tags.isMemberTag('Eigen tag')).toBe(false);
    });
});
