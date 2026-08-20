// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { EmailMocker } from '@stamhoofd/email';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Organization, User } from '@stamhoofd/models';
import { STPackageFactory, Token, UserFactory } from '@stamhoofd/models';
import {
    appToUri,
    PermissionLevel,
    Permissions,
    STPackageBundle,
    Token as TokenStruct,
    Version,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { initMembershipOrganization } from '../init/initMembershipOrganization.js';
import { WorkerData } from '../helpers/index.js';

EmailMocker.infect();

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        if (organizationId) {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        } else {
            window.localStorage.setItem('token-platform', tokenString);
        }
    }, { organizationId, tokenString });
}

test.describe('Settlements administration (organization mode) @settlements-admin', () => {
    let membershipOrganization: Organization;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');

        // Without an active package the dashboard shows onboarding instead of the finances menu
        membershipOrganization = await initMembershipOrganization();
        await new STPackageFactory({ organization: membershipOrganization, bundle: STPackageBundle.Members }).create();
        await STPackageService.updateOrganizationPackages(membershipOrganization.id);
    });

    /**
     * The settlements tooling is only for full platform admins on the membership organization, and
     * hidden behind the 'settlements' feature flag.
     */
    async function init({ featureFlag = true } = {}) {
        membershipOrganization.privateMeta.featureFlags = featureFlag ? ['settlements'] : [];
        await membershipOrganization.save();

        const admin = await new UserFactory({
            email: 'settlements-admin@stamhoofd.be',
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        return { membershipOrganization, admin };
    }

    test('A platform admin can start a settlements export from the finances menu', async ({ page }) => {
        const { membershipOrganization, admin } = await init();
        await loginAs({ page, user: admin });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${membershipOrganization.uri}/boekhouding`);

        // Both entries are visible behind the feature flag
        await expect(page.getByRole('heading', { name: 'Uitbetalingen synchroniseren', exact: true })).toBeVisible();
        await page.getByRole('heading', { name: 'Opgeslagen uitbetalingen exporteren', exact: true }).click();

        // The export view opens and can be submitted (the title also sits in the navigation bar,
        // so scope to the view's main content)
        const saveView = page.getByTestId('save-view').last();
        await expect(saveView.locator('main').getByRole('heading', { name: 'Opgeslagen uitbetalingen exporteren', exact: true })).toBeVisible();
        await saveView.getByTestId('save-button').click();

        // The report is built from the (empty) stored data and mailed to the admin
        await expect.poll(async () => (await EmailMocker.getSucceededEmails()).filter(e => e.subject.startsWith('Uitbetalingen export')).length, { timeout: 20_000 }).toBe(1);
        const email = (await EmailMocker.getSucceededEmails()).find(e => e.subject.startsWith('Uitbetalingen export'))!;
        expect(email.to).toContain(admin.email);
        expect(email.attachments).toHaveLength(1);
        expect(email.attachments![0].filename).toContain('.xlsx');
    });

    test('Without the feature flag the settlements entries stay hidden', async ({ page }) => {
        const { membershipOrganization, admin } = await init({ featureFlag: false });
        await loginAs({ page, user: admin });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${membershipOrganization.uri}/boekhouding`);

        // The neighbouring payout report entry is visible, the flagged entries are not
        await expect(page.getByRole('heading', { name: 'Overschrijvingen controleren', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Opgeslagen uitbetalingen exporteren', exact: true })).not.toBeVisible();
        await expect(page.getByRole('heading', { name: 'Uitbetalingen synchroniseren', exact: true })).not.toBeVisible();
    });
});
