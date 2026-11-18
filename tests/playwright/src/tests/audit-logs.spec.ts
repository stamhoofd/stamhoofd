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
import { AuditLogReplacement, AuditLogType, Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
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
        // The "vandaag" filter uses the Europe/Brussels day, while this process runs in UTC on CI
        const todayNoon = Formatter.luxon().set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
        const today = todayNoon.toJSDate();
        const yesterday = todayNoon.minus({ days: 1 }).toJSDate();
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

function filterMenuRow(page: Page, title: string) {
    return page.locator('h3.style-title-list:visible').filter({ hasText: new RegExp(`^\\s*${title}\\s*$`) }).last();
}

async function applyFilter(page: Page) {
    await page.locator('button:visible').filter({ hasText: /^\s*Toepassen\s*$/ }).last().click();
}

test.describe('Audit log type filter @audit', () => {
    let organization: Organization;
    let user: User;

    const memberAdded = 'Emma Peeters werd aangemaakt';
    const memberEdited = 'De gegevens van Noah Maes werden gewijzigd';
    const orderAdded = 'Bestelling #124 werd geplaatst (voor Spaghettiavond)';
    const webshopEdited = 'De webshop Spaghettiavond werd gewijzigd';
    const memberRegistered = 'Lotte Wouters werd ingeschreven voor Kapoenen';

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);
        organization = await new OrganizationFactory({ packages: [STPackageBundle.Members, STPackageBundle.Webshops] }).create();
        await STPackageService.updateOrganizationPackages(organization.id);
        user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const value = (v: string) => AuditLogReplacement.create({ value: v });
        for (const [type, replacements] of [
            [AuditLogType.MemberAdded, { m: value('Emma Peeters') }],
            [AuditLogType.MemberEdited, { m: value('Noah Maes') }],
            [AuditLogType.OrderAdded, { o: value('bestelling #124'), w: value('Spaghettiavond') }],
            [AuditLogType.WebshopEdited, { w: value('Spaghettiavond') }],
            [AuditLogType.MemberRegistered, { m: value('Lotte Wouters'), g: value('Kapoenen') }],
        ] as const) {
            const log = new AuditLog();
            log.organizationId = organization.id;
            log.type = type;
            log.replacements = new Map(Object.entries(replacements));
            await log.save();
        }
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('combines types from different categories with or', async ({ page }) => {
        await loginAs(page, user);
        await page.goto(WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/audit-logs');

        const main = activeLogs(page);
        for (const text of [memberAdded, memberEdited, orderAdded, webshopEdited, memberRegistered]) {
            await expect(main.getByText(text, { exact: true })).toBeVisible();
        }

        await main.locator('button').filter({ hasText: /^\s*Filter\s*$/ }).click();

        // Categories that never appear in the log of an organization outside a platform are left out
        await expect(filterMenuRow(page, 'Leden')).toBeVisible();
        await expect(filterMenuRow(page, 'Aansluitingen')).toHaveCount(0);
        await expect(filterMenuRow(page, 'Lokale groepen')).toHaveCount(0);

        await filterMenuRow(page, 'Leden').click();
        await page.locator('h3:visible').filter({ hasText: /^\s*Selecteer alles\s*$/ }).click();
        await applyFilter(page);

        await filterMenuRow(page, 'Webshops en bestellingen').click();
        await filterMenuRow(page, 'Nieuwe bestellingen').click();
        await applyFilter(page);

        // The filter menu applies changes immediately; click outside it to close it
        await page.mouse.click(120, 500);

        await expect(main.getByText(memberAdded, { exact: true })).toBeVisible();
        await expect(main.getByText(memberEdited, { exact: true })).toBeVisible();
        await expect(main.getByText(orderAdded, { exact: true })).toBeVisible();
        await expect(main.getByText(webshopEdited, { exact: true })).toHaveCount(0);
        await expect(main.getByText(memberRegistered, { exact: true })).toHaveCount(0);
    });
});
