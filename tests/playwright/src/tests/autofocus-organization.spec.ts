// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriod, UserFactory } from '@stamhoofd/models';
import { appToUri, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

// AutofocusDirective focuses after 300ms; waiting well past that (and any scroll animation) is the only way to assert it did nothing
const AUTOFOCUS_SETTLE_MS = 2000;

function randomId() {
    return `${WorkerData.id}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function createOrganization() {
    const id = randomId();
    const organization = await new OrganizationFactory({
        name: `Autofocus ${id}`,
        uri: `autofocus-${id}`,
        packages: [STPackageBundle.Members],
    }).create();
    await STPackageService.updateOrganizationPackages(organization.id);

    const period = await RegistrationPeriod.getByID(organization.periodId);
    if (!period) {
        throw new Error('Missing registration period for organization');
    }
    await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
    return organization;
}

async function openDashboardAsAdmin(page: Page, organization: Organization) {
    const user = await new UserFactory({
        email: `autofocus-${randomId()}@test.be`,
        organization,
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();

    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId: organization.id, tokenString });

    await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);
}

async function openMembersMenuAction(page: Page, title: string) {
    await page.locator('[data-testid="tab-button"][data-tab-id="members"]').click();
    const menu = page.getByTestId('members-menu');
    await menu.getByRole('button').filter({ hasText: 'Meer' }).click();
    await page.getByTestId('context-menu-item-title').filter({ hasText: title }).click();
}

/** scrollTop of the nearest scrollable ancestor, the element ViewportHelper and the browser scroll on focus */
async function getScrollTop(input: Locator) {
    return await input.evaluate((el) => {
        let parent = el.parentElement;
        while (parent) {
            const overflowY = getComputedStyle(parent).overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
                return parent.scrollTop;
            }
            parent = parent.parentElement;
        }
        return document.scrollingElement?.scrollTop ?? 0;
    });
}

test.describe('Autofocus @autofocus', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    test('focuses the email input on the login page', async ({ page }) => {
        const organization = await createOrganization();
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);

        await expect(page.getByTestId('email-input')).toBeFocused();
    });

    test.describe('on mobile', () => {
        test.use(mobile);

        test('focuses the email input on the login page', async ({ page }) => {
            const organization = await createOrganization();
            await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);

            await expect(page.getByTestId('email-input')).toBeFocused();
        });

        test('does not scroll to the name of a new group below the fold', async ({ page }) => {
            const organization = await createOrganization();
            await openDashboardAsAdmin(page, organization);
            await openMembersMenuAction(page, 'Nieuwe groep');

            const nameInput = page.getByPlaceholder('Naam van deze groep').first();
            await expect(nameInput).toBeAttached();
            await page.waitForTimeout(AUTOFOCUS_SETTLE_MS);

            expect(await getScrollTop(nameInput)).toBe(0);
            await expect(nameInput).not.toBeFocused();
            // The category overview pushes the name input off screen on mobile: that is the case under test
            await expect(nameInput).not.toBeInViewport();
        });

        test('focuses the name of a new category without scrolling', async ({ page }) => {
            const organization = await createOrganization();
            await openDashboardAsAdmin(page, organization);
            await openMembersMenuAction(page, 'Nieuwe categorie');

            const nameInput = page.getByPlaceholder('Naam van deze categorie');
            await expect(nameInput).toBeFocused();
            await page.waitForTimeout(AUTOFOCUS_SETTLE_MS);

            expect(await getScrollTop(nameInput)).toBe(0);
            await expect(nameInput).toBeInViewport();
        });
    });
});
