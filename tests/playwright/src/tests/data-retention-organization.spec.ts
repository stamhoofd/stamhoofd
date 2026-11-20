// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Organization, User } from '@stamhoofd/models';
import { DataRetentionPolicy, DataRetentionRun, MemberFactory, OrganizationFactory, Platform, RegistrationFactory, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { appToUri, DataRetentionAction, DataRetentionCategory, DataRetentionCount, DataRetentionHoldReason, DataRetentionOverview, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

const PASSWORD = 'testAbc123456';

async function loginAs({ page, user, fresh }: { page: Page; user: User; fresh: boolean }) {
    const token = await SessionService.createSession(user, { authenticatedAt: fresh ? new Date() : null });
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId, tokenString });
}

async function selectTab(page: Page, tabId: string) {
    await expect(page.locator('[data-testid="tab-button"]:visible').first()).toBeVisible();
    const directTab = page.locator(`[data-testid="tab-button"][data-tab-id="${tabId}"]:visible`).first();
    if (await directTab.count() > 0) {
        await directTab.click();
        return;
    }
    await page.locator('[data-testid="tab-button"][data-tab-id="more"]:visible').first().click();
    await page.locator(`[data-testid="tab-dropdown-item"][data-tab-id="${tabId}"]:visible`).first().click();
}

function activePopup(page: Page) {
    return page.locator('div.popup.focused').last();
}

async function createOrganizationWithAdmin() {
    // In userMode organization, both the platform and the organization have to turn it on
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = [...platform.config.featureFlags.filter(f => f !== 'data-retention'), 'data-retention'];
    await platform.save();

    const organization = await new OrganizationFactory({}).create();
    organization.privateMeta.featureFlags = ['data-retention'];
    await organization.save();

    const admin = await new UserFactory({
        organization,
        email: `data-retention-${Math.random().toString(36).slice(2)}@example.com`,
        password: PASSWORD,
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();
    return { organization, admin };
}

async function openDataRetention(page: Page, organization: Organization) {
    await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);
    await selectTab(page, 'settings');
    await page.getByTestId('open-data-retention-settings').click();
}

async function openMembersTerm(page: Page, organization: Organization) {
    await openDataRetention(page, organization);
    await activePopup(page).getByTestId('data-retention-' + DataRetentionCategory.Members).click();
}

async function getMembersPolicy(organization: Organization) {
    return await DataRetentionPolicy.select()
        .where('organizationId', organization.id)
        .where('category', DataRetentionCategory.Members)
        .first(false);
}

test.describe('Data retention @data-retention', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('a first term waits 30 days, and the list shows when it starts', async ({ page }) => {
        const { organization, admin } = await createOrganizationWithAdmin();
        await loginAs({ page, user: admin, fresh: true });
        await openMembersTerm(page, organization);

        await activePopup(page).getByTestId('data-retention-anonymize').click();
        await activePopup(page).getByRole('button', { name: 'Opslaan' }).click();

        const row = activePopup(page).getByTestId('data-retention-' + DataRetentionCategory.Members);
        await expect(row).toContainText('Wijzigt op');
        await expect(row).toContainText('Geen termijn: blijft bewaard');

        const policy = await getMembersPolicy(organization);
        expect(policy?.anonymizeAfterMonths).toBeNull();
        expect(policy?.pendingAnonymizeAfterMonths).toBe(24);
        expect(policy?.pendingFrom).not.toBeNull();
    });

    test('a session that is not fresh confirms the password before saving', async ({ page }) => {
        const { organization, admin } = await createOrganizationWithAdmin();
        await loginAs({ page, user: admin, fresh: false });
        await openMembersTerm(page, organization);

        await activePopup(page).getByTestId('data-retention-anonymize').click();
        await activePopup(page).getByRole('button', { name: 'Opslaan' }).click();

        const reauthView = page.getByTestId('reauthenticate-view');
        await expect(reauthView).toBeVisible({ timeout: 20_000 });
        await reauthView.getByTestId('reauth-password').fill(PASSWORD);
        await reauthView.getByTestId('reauth-submit').click();
        await expect(reauthView).toBeHidden({ timeout: 20_000 });

        await expect(activePopup(page).getByTestId('data-retention-' + DataRetentionCategory.Members)).toContainText('Wijzigt op');
        expect((await getMembersPolicy(organization))?.pendingAnonymizeAfterMonths).toBe(24);
    });

    test('deleting before anonymizing is refused before anything is saved', async ({ page }) => {
        const { organization, admin } = await createOrganizationWithAdmin();
        await loginAs({ page, user: admin, fresh: true });
        await openMembersTerm(page, organization);

        await activePopup(page).getByTestId('data-retention-anonymize').click();
        await activePopup(page).getByTestId('data-retention-delete').click();
        // Anonymizing starts at 2 years: deleting after 1 year is shorter
        const deleteInput = activePopup(page).getByTestId('data-retention-delete-input').locator('input');
        await deleteInput.fill('1');
        await deleteInput.blur();
        await activePopup(page).getByRole('button', { name: 'Opslaan' }).click();

        await expect(activePopup(page)).toContainText('De termijn om te verwijderen mag niet korter zijn dan de termijn om te anonimiseren.');
        expect(await getMembersPolicy(organization)).toBeNull();
    });

    test('saving a term that processes existing data asks for confirmation with the numbers', async ({ page }) => {
        const { organization, admin } = await createOrganizationWithAdmin();
        const member = await new MemberFactory({ organization }).create();
        const registration = await new RegistrationFactory({ member, organization }).create();
        registration.endDate = new Date('2018-08-31T00:00:00.000Z');
        await registration.save();

        await loginAs({ page, user: admin, fresh: true });
        await openMembersTerm(page, organization);

        await activePopup(page).getByTestId('data-retention-anonymize').click();
        // The member is registered in the current period, which is protected by default
        await activePopup(page).getByTestId('data-retention-protected-periods').click();
        await activePopup(page).getByRole('button', { name: 'Opslaan' }).click();

        const confirmation = page.getByTestId('centered-message');
        await expect(confirmation).toContainText('Leden anonimiseren: 1 vanaf');
        await confirmation.getByRole('button', { name: 'Termijn opslaan' }).click();

        await expect(activePopup(page).getByTestId('data-retention-' + DataRetentionCategory.Members)).toContainText('Wijzigt op');
        expect((await getMembersPolicy(organization))?.pendingAnonymizeAfterMonths).toBe(24);
    });

    test('cancelling the confirmation saves nothing', async ({ page }) => {
        const { organization, admin } = await createOrganizationWithAdmin();
        const member = await new MemberFactory({ organization }).create();
        const registration = await new RegistrationFactory({ member, organization }).create();
        registration.endDate = new Date('2018-08-31T00:00:00.000Z');
        await registration.save();

        await loginAs({ page, user: admin, fresh: true });
        await openMembersTerm(page, organization);

        await activePopup(page).getByTestId('data-retention-anonymize').click();
        await activePopup(page).getByTestId('data-retention-protected-periods').click();
        await activePopup(page).getByRole('button', { name: 'Opslaan' }).click();

        const confirmation = page.getByTestId('centered-message');
        await expect(confirmation).toBeVisible();
        await confirmation.getByRole('button', { name: 'Annuleren' }).click();
        await expect(confirmation).toBeHidden();

        expect(await getMembersPolicy(organization)).toBeNull();
    });

    test('the overview shows what the last count found, per month and what is held', async ({ page }) => {
        const { organization, admin } = await createOrganizationWithAdmin();
        // Next month is shown on its own, a month two years from now is part of the rest.
        // The middle of the month, so the time zone cannot move it to another month.
        const today = new Date();
        const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 15));
        const muchLater = new Date(Date.UTC(today.getUTCFullYear() + 2, today.getUTCMonth() + 1, 15));
        const monthKey = (date: Date) => date.toISOString().slice(0, 7);
        await DataRetentionRun.delete();
        const run = await DataRetentionRun.getOrCreate('1');
        run.finishedAt = new Date();
        run.result = new Map([[organization.id, DataRetentionOverview.create({
            counts: [
                DataRetentionCount.create({
                    category: DataRetentionCategory.Members,
                    action: DataRetentionAction.Anonymize,
                    due: 5,
                    held: 2,
                    heldBy: new Map([[DataRetentionHoldReason.OpenBalance, 2]]),
                    upcoming: new Map([[monthKey(nextMonth), 3], [monthKey(muchLater), 4], ['later', 6]]),
                }),
            ],
        })]]);
        await run.save();

        await loginAs({ page, user: admin, fresh: true });
        await openDataRetention(page, organization);
        await activePopup(page).getByTestId('open-data-retention-overview').click();

        // Grouped per moment, in the order things happen
        const group = (key: string) => activePopup(page).getByTestId('data-retention-overview-' + key);
        await expect(group('now')).toContainText('Leden anonimiseren');
        await expect(group('now')).toContainText('5');
        await expect(group(monthKey(nextMonth))).toContainText('3');
        await expect(group('later')).toContainText('10');
        await expect(activePopup(page)).toContainText('Openstaand bedrag of betaling in verwerking');
    });
});
