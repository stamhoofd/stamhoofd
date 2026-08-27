import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { Context, ContextInstance } from './Context.js';

describe('Context', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.French, Language.English] });
    });

    test('i18n uses the user language when the organization scope is set before the user', async () => {
        const organization = await new OrganizationFactory({}).create();
        organization.language = Language.Dutch;
        await organization.save();

        const user = await new UserFactory({ organization }).create();
        user.language = Language.French;
        await user.save();

        await ContextInstance.startForUser(user, organization, async () => {
            expect(Context.i18n.language).toBe(Language.French);
            expect(Context.i18n.country).toBe(organization.address.country);
        });
    });

    test('i18n falls back to the organization language when the user has none', async () => {
        const organization = await new OrganizationFactory({}).create();
        organization.language = Language.French;
        await organization.save();

        const user = await new UserFactory({ organization }).create();

        await ContextInstance.startForUser(user, organization, async () => {
            expect(Context.i18n.language).toBe(Language.French);
        });
    });

    test('i18n prefers the request language over the user language', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        user.language = Language.French;
        await user.save();

        const request = Request.get({ path: '/', host: organization.getApiHost(), headers: { 'x-locale': 'en-BE' } });
        await ContextInstance.start(request, async () => {
            await Context.setManualOrganizationScope(organization);
            await Context.insecurelyAuthenticateAs(user);
            expect(Context.i18n.language).toBe(Language.English);
        });
    });
});
