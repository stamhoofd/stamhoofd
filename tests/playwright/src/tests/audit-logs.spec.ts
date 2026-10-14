// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { AuditLog, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import type { Organization, User } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { randomUUID } from 'node:crypto';
import { WorkerData } from '../helpers/worker/WorkerData.js';

async function loginAs(page: Page, user: User) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.removeItem('user-platform');
        window.localStorage.removeItem('token-platform');
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId: user.organizationId, tokenString });
}

function activeLogs(page: Page) {
    return page.locator('#settings-view:visible').filter({ has: page.getByRole('heading', { name: 'Logboek', exact: true }) }).last();
}

async function openObjectLogs(page: Page, row: Locator) {
    await row.click({ button: 'right' });
    await page.getByTestId('context-menu-item-title').filter({ hasText: 'Toon alle gebeurtenissen van dit object' }).click();
}

test.describe('Audit log navigation @audit', () => {
    test.use({ timezoneId: 'Europe/Brussels' });

    let organization: Organization;
    let user: User;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);
        organization = await new OrganizationFactory({ packages: [STPackageBundle.Members] }).create();
        await STPackageService.updateOrganizationPackages(organization.id);
        user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const objectId = randomUUID();
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        for (const entry of [
            { objectId, description: 'Audit target today', createdAt: today },
            { objectId, description: 'Audit target yesterday', createdAt: yesterday },
            { objectId: randomUUID(), description: 'Audit unrelated object', createdAt: today },
        ]) {
            const log = new AuditLog();
            log.organizationId = organization.id;
            Object.assign(log, entry);
            await log.save();
        }
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    for (const width of [1280, 600]) {
        test(`nested object histories preserve filters and return correctly at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await loginAs(page, user);
            await page.goto(WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/audit-logs');

            const main = activeLogs(page);
            await expect(main.getByText('Audit target yesterday', { exact: true })).toBeVisible();
            await main.getByRole('button', { name: 'vandaag', exact: true }).click();
            await expect(main.getByText('Audit target yesterday', { exact: true })).toHaveCount(0);
            await expect(main.getByText('Audit unrelated object', { exact: true })).toBeVisible();

            await openObjectLogs(page, main.locator('.st-list-item', { hasText: 'Audit target today' }));
            const first = activeLogs(page);
            await expect(first.getByText('Audit target yesterday', { exact: true })).toBeVisible();
            await expect(first.getByText('Audit unrelated object', { exact: true })).toHaveCount(0);
            await first.getByRole('button', { name: 'gisteren', exact: true }).click();
            await expect(first.getByText('Audit target today', { exact: true })).toHaveCount(0);

            await openObjectLogs(page, first.locator('.st-list-item', { hasText: 'Audit target yesterday' }));
            await expect(activeLogs(page).getByText('Audit target today', { exact: true })).toBeVisible();
            await expect(activeLogs(page).getByText('Audit target yesterday', { exact: true })).toBeVisible();
            await expect(activeLogs(page).getByText('Audit unrelated object', { exact: true })).toHaveCount(0);

            await page.goBack();
            await expect(activeLogs(page).getByText('Audit target today', { exact: true })).toHaveCount(0);
            await expect(activeLogs(page).getByText('Audit target yesterday', { exact: true })).toBeVisible();
            await activeLogs(page).getByTestId('close-button').click();
            await expect(activeLogs(page).getByText('Audit target today', { exact: true })).toBeVisible();
            await expect(activeLogs(page).getByText('Audit unrelated object', { exact: true })).toBeVisible();
            await expect(activeLogs(page).getByText('Audit target yesterday', { exact: true })).toHaveCount(0);
        });
    }
});
