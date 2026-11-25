// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Group, Organization, User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriod, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { GroupCategory, GroupCategorySettings, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Pages, TableHelper, WorkerData } from '../helpers/index.js';

async function seed(): Promise<{ organization: Organization; group: Group; user: User }> {
    const runId = `${WorkerData.id}-${Date.now()}`;
    const organization = await new OrganizationFactory({
        name: `Export Names ${runId}`,
        uri: `export-names-${runId}`,
        packages: [STPackageBundle.Members],
    }).create();
    await STPackageService.updateOrganizationPackages(organization.id);

    const period = await RegistrationPeriod.getByID(organization.periodId);
    if (!period) {
        throw new Error('Missing registration period for organization');
    }
    const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
    const group = await new GroupFactory({ organization, period, name: new TranslatedString('Kapoenen') }).create();

    // The group must be part of a category to show up in the dashboard
    const category = GroupCategory.create({
        settings: GroupCategorySettings.create({ name: 'Takken' }),
        groupIds: [group.id],
    });
    organizationPeriod.settings.categories.push(category);
    organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
    await organizationPeriod.save();

    for (const [firstName, lastName] of [['Lotte', 'Peeters'], ['Jonas', 'Maes']]) {
        const member = await new MemberFactory({ organization, firstName, lastName }).create();
        await new RegistrationFactory({ member, group }).create();
    }

    const user = await new UserFactory({
        email: `export-names-${runId}@test.be`,
        organization,
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();

    return { organization, group, user };
}

async function loginAs(page: Page, user: User, organization: Organization) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId: organization.id, tokenString });
}

function withoutExtension(fileName: string) {
    return fileName.replace(/\.(?:xlsx|pdf)$/, '');
}

async function exportToExcel(page: Page): Promise<string> {
    await new TableHelper(page).clickActions(['Exporteren naar', 'Excel...']);
    const exportView = page.getByTestId('save-view').filter({ has: page.getByRole('heading', { name: 'Exporteren naar Excel' }) });
    await exportView.getByTestId('save-button').click();

    // The file is prepared on the server and offered in a toast
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.toast-view').filter({ hasText: 'Downloaden' }).last().click();
    return (await downloadPromise).suggestedFilename();
}

async function exportToPdf(page: Page): Promise<string> {
    await new TableHelper(page).clickActions(['Exporteren naar', 'PDF...']);
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('save-button').last().click();
    const fileName = (await downloadPromise).suggestedFilename();
    await page.keyboard.press('Escape');
    return fileName;
}

test.describe('Members export file names @members-export-file-names', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    test('names the Excel and PDF export of a group the same', async ({ page }) => {
        test.setTimeout(120_000);
        const { organization, group, user } = await seed();
        await loginAs(page, user, organization);

        await new Pages(page).groupOverview({ group, organization }).gotoRegistrations();
        const table = new TableHelper(page);
        await table.waitForFirstRow();

        // Without a selection both exports are named after the group
        const excel = await exportToExcel(page);
        const pdf = await exportToPdf(page);
        expect(excel).toMatch(/\.xlsx$/);
        expect(pdf).toMatch(/\.pdf$/);
        expect(withoutExtension(excel)).toContain('Kapoenen - Inschrijvingen');
        expect(withoutExtension(pdf)).toBe(withoutExtension(excel));

        // With one selected member both exports are named after that member
        await table.toggleSelectRow('Lotte');
        expect(await exportToExcel(page)).toBe('Lotte Peeters.xlsx');
        expect(await exportToPdf(page)).toBe('Lotte Peeters.pdf');
    });
});
