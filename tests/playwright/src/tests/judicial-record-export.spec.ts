// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Download, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Organization, User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, MemberResponsibilityRecordFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, PlatformResponsibilityFactory, RegistrationFactory, RegistrationPeriod, UserFactory } from '@stamhoofd/models';
import type { MemberResponsibility } from '@stamhoofd/structures';
import { appToUri, GroupCategory, GroupCategorySettings, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { TestUtils } from '@stamhoofd/test-utils';
import { readFile } from 'node:fs/promises';
import XLSX from 'xlsx';
import { TableHelper, WorkerData } from '../helpers/index.js';

const columnName = 'Uittreksel uit het strafregister';
const groupName = 'Leiding';

type Scenario = {
    organization: Organization;
    user: User;
    names: {
        /** Adult, holds a responsibility that asks for an extract */
        required: string;
        /** Holds the same responsibility, but is too young */
        tooYoung: string;
        /** Adult, but their responsibility never asks for an extract */
        notAsked: string;
    };
};

test.describe('Judicial record status export @judicial-record-export', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario(): Promise<Scenario> {
        const runId = `${WorkerData.id}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `Judicial Record Organization ${runId}`,
            uri: `judicial-record-organization-${runId}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const period = await RegistrationPeriod.getByID(organization.periodId);
        if (!period) {
            throw new Error('Missing registration period for organization');
        }

        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
        const group = await new GroupFactory({ organization, period, name: new TranslatedString(groupName) }).create();

        // The group must be part of a category to show up in the period groups
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [group.id],
        });
        organizationPeriod.settings.categories.push(category);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
        await organizationPeriod.save();

        const asksForExtract = await new PlatformResponsibilityFactory({
            name: `Takleiding ${runId}`,
            judicialRecordMinimumAge: 18,
        }).create();
        const neverAsks = await new PlatformResponsibilityFactory({
            name: `Kok ${runId}`,
            judicialRecordMinimumAge: null,
        }).create();

        const names = {
            required: `Nora-${runId}`,
            tooYoung: `Tim-${runId}`,
            notAsked: `Kaat-${runId}`,
        };

        const createMember = async ({ firstName, birthDay, responsibility }: { firstName: string; birthDay: { year: number; month: number; day: number }; responsibility: MemberResponsibility }) => {
            const member = await new MemberFactory({ organization, firstName, lastName: 'Lid', birthDay }).create();
            await new RegistrationFactory({ member, group }).create();
            await new MemberResponsibilityRecordFactory({
                member,
                responsibility,
                organizationId: organization.id,
                startDate: new Date(2024, 0, 1),
            }).create();
            return member;
        };

        await createMember({ firstName: names.required, birthDay: { year: 1992, month: 3, day: 10 }, responsibility: asksForExtract });
        await createMember({ firstName: names.tooYoung, birthDay: { year: 2015, month: 6, day: 15 }, responsibility: asksForExtract });
        await createMember({ firstName: names.notAsked, birthDay: { year: 1988, month: 9, day: 1 }, responsibility: neverAsks });

        const user = await new UserFactory({
            firstName: 'Judicial',
            lastName: 'Record Admin',
            email: `judicial-record-admin-${runId}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        return { organization, user, names };
    }

    async function loginAs({ page, user }: { page: Page; user: User }) {
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });
    }

    async function openMemberList({ page, scenario }: { page: Page; scenario: Scenario }) {
        await loginAs({ page, user: scenario.user });
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        // The list of all members, so the export covers every seeded member regardless of period
        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu.first()).toBeVisible();
        await membersMenu.locator('button.menu-button', { hasText: 'Meer' }).click();

        const item = page.getByTestId('context-menu-item-title').filter({ hasText: 'Alle leden (alle werkjaren)' });
        await expect(item).toBeVisible();
        await item.click();

        await page.getByTestId('table').waitFor();
        await new TableHelper(page).waitForFirstRow();
    }

    async function openRegistrationsList({ page, scenario }: { page: Page; scenario: Scenario }) {
        await loginAs({ page, user: scenario.user });
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu.first()).toBeVisible();
        await membersMenu.getByText(groupName).first().click();
        await page.locator('.st-list-item', { hasText: 'Ingeschreven leden' }).first().click();

        await page.getByTestId('table').waitFor();
        await new TableHelper(page).waitForFirstRow();
    }

    /** The judicial record column is off by default, like every other opt-in column. */
    async function selectJudicialRecordColumn(exportView: Locator) {
        const item = exportView.locator('label.st-list-item').filter({ hasText: columnName }).first();
        await expect(item).toBeVisible();
        await item.getByTestId('checkbox').click();
    }

    /** The pdf is built in the browser, so saving the view downloads it right away. */
    async function downloadPdf(page: Page, exportView: Locator): Promise<Download> {
        const downloadPromise = page.waitForEvent('download');
        await exportView.getByTestId('save-button').click();
        const download = await downloadPromise;
        expect(await download.failure()).toBeNull();
        return download;
    }

    /** The excel file is built by the backend, so the view closes and a toast offers the finished file. */
    async function downloadExcel(page: Page, exportView: Locator): Promise<Download> {
        await exportView.getByTestId('save-button').click();

        const toast = page.getByTestId('toast-box').locator('.toast-view').filter({ hasText: 'Downloaden' });
        await expect(toast).toBeVisible({ timeout: 60_000 });

        const downloadPromise = page.waitForEvent('download');
        await toast.click();
        const download = await downloadPromise;
        expect(await download.failure()).toBeNull();
        return download;
    }

    /**
     * The judicial record status per member, read back from the downloaded sheet. A sheet starts with a
     * category row above the header row, unless none of its columns has a category.
     */
    async function readSheet(download: Download, sheetName: string, saveAsPath: string) {
        await download.saveAs(saveAsPath);

        // The ESM build of SheetJS has no filesystem access by default: read the file manually
        const rows = XLSX.utils.sheet_to_json<(string | undefined)[]>(
            XLSX.read(await readFile(saveAsPath), { cellDates: true }).Sheets[sheetName],
            { header: 1 },
        );

        const headerIndex = rows.findIndex(row => row.includes(columnName));
        expect(headerIndex, `Expected a ${columnName} column`).toBeGreaterThanOrEqual(0);
        const headers = rows[headerIndex];

        return {
            headers,
            statusOf(firstName: string) {
                const row = rows.slice(headerIndex + 1).find(row => row.includes(firstName));
                expect(row, `Expected ${firstName} to be exported`).toBeDefined();
                return row?.[headers.indexOf(columnName)];
            },
        };
    }

    test('exports the judicial record status of every member to excel', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario();
        await page.setViewportSize({ width: 1280, height: 800 });
        await openMemberList({ page, scenario });

        await new TableHelper(page).clickActions(['Exporteren naar', 'Excel...']);

        const exportView = page.getByTestId('save-view');
        await expect(exportView.getByRole('heading', { name: 'Exporteren naar Excel' })).toBeVisible();

        await selectJudicialRecordColumn(exportView);

        const sheet = await readSheet(await downloadExcel(page, exportView), 'Leden', test.info().outputPath('members.xlsx'));

        expect(sheet.statusOf(scenario.names.required)).toBe('Vereist');
        expect(sheet.statusOf(scenario.names.tooYoung)).toBe('Niet vereist');
        expect(sheet.statusOf(scenario.names.notAsked)).toBe('Niet vereist');
    });

    test('offers the judicial record status in the pdf export of the member details', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario();
        await page.setViewportSize({ width: 1280, height: 800 });
        await openMemberList({ page, scenario });

        await new TableHelper(page).clickActions(['Exporteren naar', 'PDF...']);

        const exportView = page.getByTestId('save-view');
        await expect(exportView.getByRole('heading', { name: 'Exporteren naar PDF' })).toBeVisible();

        await selectJudicialRecordColumn(exportView);

        const pdf = await downloadPdf(page, exportView);
        const saveAsPath = test.info().outputPath('members.pdf');
        await pdf.saveAs(saveAsPath);

        const bytes = await readFile(saveAsPath);
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    });

    test('exports the judicial record status of the member of every registration to excel', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario();
        await page.setViewportSize({ width: 1280, height: 800 });
        await openRegistrationsList({ page, scenario });

        await new TableHelper(page).clickActions(['Exporteren naar', 'Excel...']);

        const exportView = page.getByTestId('save-view');
        await expect(exportView.getByRole('heading', { name: 'Exporteren naar Excel' })).toBeVisible();

        await selectJudicialRecordColumn(exportView);

        const sheet = await readSheet(await downloadExcel(page, exportView), 'Inschrijvingen', test.info().outputPath('registrations.xlsx'));

        expect(sheet.statusOf(scenario.names.required)).toBe('Vereist');
        expect(sheet.statusOf(scenario.names.tooYoung)).toBe('Niet vereist');
        expect(sheet.statusOf(scenario.names.notAsked)).toBe('Niet vereist');
    });
});
