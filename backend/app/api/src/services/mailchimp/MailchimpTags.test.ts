import { I18n } from '@stamhoofd/backend-i18n';
import { OrganizationFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
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

    test('tags start with the name of the platform, and tags from before that are still managed', () => {
        const i18n = new I18n(Language.Dutch, Country.Belgium);
        i18n.messages = new Map([['%1PI', 'Groep'], ['%wH', 'Leeftijdsgroep'], ['%1PM', 'Lid'], ['%ZwU', 'Besteller'], ['%1AV', 'Webshop']]);
        const tags = new MailchimpTags(i18n, 'Ravot');

        expect(tags.member).toBe('Ravot: Lid');
        expect(tags.organization('KSA Brugge')).toBe('Ravot: Groep – KSA Brugge');
        expect(tags.ageGroup('Kabouters')).toBe('Ravot: Leeftijdsgroep – Kabouters');

        expect(tags.isMemberTag('Ravot: Lid')).toBe(true);
        expect(tags.isMemberTag('Stamhoofd: Groep – Kabouters')).toBe(true);
        expect(tags.isOrderTag('Stamhoofd: Besteller')).toBe(true);
        expect(tags.isOrderTag('Stamhoofd: Webshop – Wafelbak')).toBe(true);
        expect(tags.isManaged('Keeo: Lid')).toBe(false);
        expect(tags.isManaged('Eigen tag')).toBe(false);
    });
});
