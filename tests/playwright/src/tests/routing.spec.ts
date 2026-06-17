// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { EventFactory, OrganizationFactory, Platform, Token, UserFactory } from '@stamhoofd/models';
import type { AppType } from '@stamhoofd/structures';
import { PermissionLevel, Permissions, PlatformEventType, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/worker/WorkerData.js';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';

async function loginAs({ page, user }: { page: Page; user: User }) {
    // create token
    const token = await Token.createToken(user);
    const tokenString = JSON.stringify(
        new TokenStruct(token).encode({ version: Version }),
    );

    // Set local storage data
    if (STAMHOOFD.userMode === 'platform') {
        await page.addInitScript(({ tokenString }) => {
            window.localStorage.removeItem('user-platform');
            window.localStorage.setItem('token-platform', tokenString);
        }, { tokenString });
    } else {
        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.removeItem('user-platform');
            window.localStorage.removeItem('token-platform');

            if (organizationId) {
                window.localStorage.removeItem('user-' + organizationId);
                window.localStorage.setItem('token-' + organizationId, tokenString);
            } else {
                window.localStorage.setItem('token-platform', tokenString);
            }
        }, { organizationId, tokenString });
    }
}

async function logout({ page }: { page: Page }) {
    // Set local storage data
    if (STAMHOOFD.userMode === 'platform') {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
    } else {
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
    }
}

async function checkScopedTo({ page, organization }: { page: Page; organization: Organization | null }) {
    await expect(page.locator('[data-organization-scope="' + (organization?.id ?? null) + '"]')).toBeVisible();
}

type SwitcherOption = {
    app: AppType;
    organization: Organization | null;
    title: string;
    description?: string;
};

type Switcher = {
    options: SwitcherOption[];
    includeSearchOthers?: boolean;
};

/**
 * Reusable switcher options.
 */
const adminOption: SwitcherOption = {
    app: 'admin',
    organization: null,
    title: 'Administratieportaal',
    description: 'Portaal voor beroepskrachten',
};
const unscopedMemberPortalOption: SwitcherOption = {
    app: 'registration',
    organization: null,
    title: 'Ledenportaal',
    description: 'Jouw gegevens en inschrijvingen',
};
const scopedMemberPortalOption = (organization: Organization, title: string = 'Ledenportaal', description: string = 'Jouw gegevens en inschrijvingen'): SwitcherOption => ({
    app: 'registration',
    organization: organization,
    title: title,
    description: description,
});
const dashboardOption = (organization: Organization, title: string = 'Beheerdersportaal'): SwitcherOption => ({
    app: 'dashboard',
    organization: organization,
    title: title,
    description: 'Beheer je eigen vereniging',
});
const otherOrgOptions = (organization: Organization): SwitcherOption => ({
    app: 'auto',
    organization,
    title: organization.name,
    description: organization.address.anonymousString(organization.address.country),
});

async function testRoute({ page, ...spec }: {
    user: User | null;
    page: Page;
    url: string;
    expectedUrl: string;
    expectedScope: Organization | null;
    expectedLocator: string;
    /** use `false` if nothing is expected and `undefined` if no check is needed */
    expectedTopLeft?: 'organization-logo' | 'platform-logo' | Switcher | false;
}) {
    await page.goto(spec.url + '?initial=true'); // nav framework should remove this param

    // Settings view should be visible
    await expect(page.locator(spec.expectedLocator)).toBeVisible();
    await checkScopedTo({ page, organization: spec.expectedScope });

    // Wait until URL is as expected, or time-out after 5 seconds
    await expect(page).toHaveURL(spec.expectedUrl, { timeout: 5_000 });

    if (spec.expectedTopLeft === undefined) {
        return;
    }
    if (spec.expectedTopLeft === false) {
        await expect(page.locator('button.organization-switcher')).toHaveCount(0);
        await expect(page.locator('[data-testid="organization-logo"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="platform-logo"]')).toHaveCount(0);
        return;
    }

    if (spec.expectedTopLeft === 'organization-logo') {
        await expect(page.locator('button.organization-switcher')).toHaveCount(0);
        await expect(page.locator('[data-testid="organization-logo"]')).toBeVisible();
        await expect(page.locator('[data-testid="platform-logo"]')).toHaveCount(0);
        return;
    }

    if (spec.expectedTopLeft === 'platform-logo') {
        await expect(page.locator('button.organization-switcher')).toHaveCount(0);
        await expect(page.locator('[data-testid="organization-logo"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="platform-logo"]')).toBeVisible();
        return;
    }

    const switcherLocator = page.locator('button.organization-switcher');
    await expect(switcherLocator).toHaveCount(1);
    await switcherLocator.click();

    const selector = page.locator('.organization-app-switcher');
    await expect(selector).toBeVisible();

    // Every expected option should be listed in the selector
    for (const option of spec.expectedTopLeft.options) {
        const optionLocator = selector.locator(`[data-testid="app-switcher-option"][data-app="${option.app}"][data-organization="${option.organization?.id ?? 'null'}"]`);
        await expect(optionLocator).toBeVisible();
        await expect(optionLocator.locator('[data-testid="app-switcher-option-title"]')).toHaveText(option.title);

        const descriptionLocator = optionLocator.locator('[data-testid="app-switcher-option-description"]');
        if (option.description !== undefined) {
            await expect(descriptionLocator).toHaveText(option.description);
        } else {
            await expect(descriptionLocator).toHaveCount(0);
        }
    }

    // ...and no other options should be listed
    await expect(selector.locator('[data-testid="app-switcher-option"]')).toHaveCount(spec.expectedTopLeft.options.length);

    if (spec.expectedTopLeft.includeSearchOthers === undefined) {
        return;
    }
    if (spec.expectedTopLeft.includeSearchOthers) {
        await expect(selector.locator('[data-testid="app-switcher-search-others"]')).toBeVisible();
    } else {
        await expect(selector.locator('[data-testid="app-switcher-search-others"]')).toHaveCount(0);
    }
}

test.describe('Routing on page load @routing', () => {
    /**
     * Default if not set.
     */
    const user = null;
    let membershipOrganization!: Organization;
    const domain = WorkerData.urls.dashboard;

    test.beforeAll(async () => {
        membershipOrganization = await new OrganizationFactory({
            packages: [STPackageBundle.Webshops, STPackageBundle.Members],
        }).create();

        const platform = await Platform.getForEditing();
        platform.membershipOrganizationId = membershipOrganization.id;

        // Enable activities tabs
        platform.config.eventTypes = [
            PlatformEventType.create({
                name: 'Andere',
            }),
        ];

        // Save
        await platform.save();
    });

    test.describe('Platform mode', () => {
        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
        });

        test.describe('Platform Admin', () => {
            let user: User;

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    globalPermissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/instellingen',
                    expectedScope: null,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                const organization = await new OrganizationFactory({
                }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                const organization = await new OrganizationFactory({
                }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const organization = await new OrganizationFactory({}).create();
                const event = await new EventFactory({ organization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({}).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                    expectedScope: null,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/ should show organization search', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });

        test.describe('Full Organization Admin', () => {
            let organization: Organization;
            let user: User;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/<uri>/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const scopedOrganization = await new OrganizationFactory({}).create();
                const event = await new EventFactory({ organization: scopedOrganization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + scopedOrganization.uri + '/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/' + scopedOrganization.uri + '/activiteiten/' + event.slug,
                    expectedScope: scopedOrganization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({}).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                    expectedScope: null,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/ should show organization selection', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });

        test.describe('Partially Organization Admin', () => {
            let organization: Organization;
            let user: User;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.Read,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen should redirect to start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/<uri>/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const scopedOrganization = await new OrganizationFactory({}).create();
                const event = await new EventFactory({ organization: scopedOrganization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + scopedOrganization.uri + '/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/' + scopedOrganization.uri + '/activiteiten/' + event.slug,
                    expectedScope: scopedOrganization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({}).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                    expectedScope: null,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/ show organization selection', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });

        test.describe('Normal user', () => {
            let organization: Organization;
            let user: User;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    organization,
                    permissions: null,
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    // exception: can switch back to the global member portal
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri + '/geen-toegang',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    // exception: can switch back to the global member portal
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    // exception: can switch back to the global member portal
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: 'platform-logo', // can't switch
                });
            });

            test('/leden/<uri>/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const scopedOrganization = await new OrganizationFactory({}).create();
                const event = await new EventFactory({ organization: scopedOrganization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + scopedOrganization.uri + '/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/' + scopedOrganization.uri + '/activiteiten/' + event.slug,
                    expectedScope: scopedOrganization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    // exception: can switch back to the global member portal
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({}).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                    expectedScope: null,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: 'platform-logo',
                });
            });

            test('/ should redirect to /leden/start (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: 'platform-logo', // can't switch
                });
            });
        });

        test.describe('Unauthenticated user', () => {
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({}).create();
            });

            test.beforeEach(async ({ page }) => {
                await logout({ page });
            });

            test('/platform/instellingen should show login view (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                    // exception: can switch back to the global member portal
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                    // exception: can switch back to the global member portal
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri> should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                    // exception: can switch back to the global member portal
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/start should show login view (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE/leden',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });

            test('/ should show login view (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });
    });

    test.describe('Organization mode', () => {
        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'organization');
        });

        async function createOrganization() {
            const organization = await new OrganizationFactory({
                packages: [STPackageBundle.Webshops, STPackageBundle.Members],
            }).create();
            await STPackageService.updateOrganizationPackages(organization.id);
            await organization.refresh();
            return organization;
        }

        test.describe('Platform Admin', () => {
            let user: User;

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    globalPermissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/instellingen',
                    expectedScope: null,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [adminOption, otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                const organization = await createOrganization();

                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                const organization = await createOrganization();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const organization = await createOrganization();
                const event = await new EventFactory({ organization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/start redirects to selection', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });

            test('/ should show organization search', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });

        test.describe('Full Organization Admin', () => {
            let organization: Organization;
            let user: User;

            test.beforeAll(async () => {
                organization = await createOrganization();
            });

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show login view (because token not loaded in unscoped pages)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                    // org token is not loaded on unscoped pages, so no options - only "search others"
                    expectedTopLeft: {
                        options: [],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [scopedMemberPortalOption(organization), dashboardOption(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [scopedMemberPortalOption(organization), dashboardOption(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({ organization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [scopedMemberPortalOption(organization), dashboardOption(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/start should redirect to selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });

            test('/ should show selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });

        test.describe('Normal user', () => {
            let organization: Organization;
            let user: User;

            test.beforeAll(async () => {
                organization = await createOrganization();
            });

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    organization,
                    permissions: null,
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show login page (because token not loaded)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                    // org token is not loaded on unscoped pages, so no options - only "search others"
                    expectedTopLeft: {
                        options: [],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri + '/geen-toegang',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    expectedTopLeft: {
                        options: [scopedMemberPortalOption(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [scopedMemberPortalOption(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri>/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({ organization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri + '/activiteiten/' + event.slug,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [scopedMemberPortalOption(organization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/start should redirect to selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });

            test('/ should redirect to selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });

        test.describe('Unauthenticated user', () => {
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await createOrganization();
            });

            test.beforeEach(async ({ page }) => {
                await logout({ page });
            });

            test('/platform/instellingen should show login view (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                    // nothing is loaded on unscoped pages, so no options - only "search others"
                    expectedTopLeft: {
                        options: [],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: {
                        // unauthenticated → registration option renders in the 'other' position (org name + address)
                        options: [scopedMemberPortalOption(organization, organization.name, organization.address.anonymousString(organization.address.country))],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri> should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: organization.meta.packages.useMembers ? '[data-testid="members-home-view"]' : '[data-testid="login-view"]',
                    expectedTopLeft: {
                        options: [scopedMemberPortalOption(organization, organization.name, organization.address.anonymousString(organization.address.country))],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/start should redirect to organization selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });

            test('/ should show organization selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                    expectedTopLeft: 'platform-logo',
                });
            });
        });
    });

    [true, false].forEach((useRegisterDomain) => {
        test.describe(useRegisterDomain ? 'Organization mode on custom domain' : 'Organization mode on default register domain', () => {
            let organization!: Organization;
            let domain!: string;
            let expectedScope!: Organization | null;

            test.beforeAll(async () => {
                TestUtils.setPermanentEnvironment('userMode', 'organization');
                organization = await new OrganizationFactory({
                    packages: [STPackageBundle.Webshops, STPackageBundle.Members],
                }).create();
                organization.registerDomain = useRegisterDomain ? WorkerData.urls.registrationCustomDomain('scoutswetteren.be') : null; // not set
                await organization.save();
                await STPackageService.updateOrganizationPackages(organization.id);
                await organization.refresh();

                domain = useRegisterDomain ? 'https://' + organization.registerDomain : WorkerData.urls.registration(organization.uri);

                // Always scoped
                expectedScope = organization;
            });

            test.describe('Platform Admin', () => {
                let user: User;

                test.beforeEach(async ({ page }) => {
                    user = await new UserFactory({
                        globalPermissions: Permissions.create({
                            level: PermissionLevel.Full,
                        }),
                    }).create();

                    await loginAs({ user, page });
                });

                test('/platform/instellingen redirects to /beheerders/leden/instellingen', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/platform/instellingen',
                        expectedUrl: domain + '/nl-BE/beheerders/leden/instellingen',
                        expectedScope,
                        expectedLocator: '[data-testid="members-menu"]',
                        expectedTopLeft: {
                            options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/beheerders/instellingen', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/beheerders/instellingen',
                        expectedUrl: domain + '/nl-BE/beheerders/instellingen',
                        expectedScope,
                        expectedLocator: '#settings-view',
                        expectedTopLeft: {
                            options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/leden/start', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden/start',
                        expectedUrl: domain + '/nl-BE/leden/start',
                        expectedScope,
                        expectedLocator: '[data-testid="members-start-view"]',
                        expectedTopLeft: {
                            options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                    const event = await new EventFactory({ organization }).create();

                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden/activiteiten/' + event.slug,
                        expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                        expectedScope,
                        expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                        expectedTopLeft: {
                            options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/ should show dashboard', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain,
                        expectedUrl: domain + '/nl-BE/beheerders/leden/instellingen',
                        expectedScope,
                        expectedLocator: '[data-testid="members-menu"]',
                        expectedTopLeft: {
                            options: [adminOption, scopedMemberPortalOption(organization), dashboardOption(organization), otherOrgOptions(membershipOrganization)],
                            includeSearchOthers: true,
                        },
                    });
                });
            });

            test.describe('Full Organization Admin', () => {
                let user: User;

                test.beforeEach(async ({ page }) => {
                    user = await new UserFactory({
                        organization,
                        permissions: Permissions.create({
                            level: PermissionLevel.Full,
                        }),
                    }).create();

                    await loginAs({ user, page });
                });

                test('/beheerders/instellingen', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/beheerders/instellingen',
                        expectedUrl: domain + '/nl-BE/beheerders/instellingen',
                        expectedScope,
                        expectedLocator: '#settings-view',
                        expectedTopLeft: {
                            options: [scopedMemberPortalOption(organization), dashboardOption(organization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/leden/start', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden/start',
                        expectedUrl: domain + '/nl-BE/leden/start',
                        expectedScope,
                        expectedLocator: '[data-testid="members-start-view"]',
                        expectedTopLeft: {
                            options: [scopedMemberPortalOption(organization), dashboardOption(organization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                    const event = await new EventFactory({ organization }).create();

                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden/activiteiten/' + event.slug,
                        expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                        expectedScope,
                        expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                        expectedTopLeft: {
                            options: [scopedMemberPortalOption(organization), dashboardOption(organization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/ should show dashboard', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain,
                        expectedUrl: domain + '/nl-BE/beheerders/leden/instellingen',
                        expectedScope,
                        expectedLocator: '[data-testid="members-menu"]',
                        expectedTopLeft: {
                            options: [scopedMemberPortalOption(organization), dashboardOption(organization)],
                            includeSearchOthers: true,
                        },
                    });
                });
            });

            test.describe('Normal user', () => {
                let user: User;

                test.beforeEach(async ({ page }) => {
                    user = await new UserFactory({
                        organization,
                        permissions: null,
                    }).create();

                    await loginAs({ user, page });
                });

                test('/beheerders should show permissions error page', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/beheerders/instellingen',
                        expectedUrl: domain + '/nl-BE/beheerders/geen-toegang',
                        expectedScope,
                        expectedLocator: '[data-testid="no-permissions-view"]',
                        // exception: dashboard context lets the member switch to the member portal
                        expectedTopLeft: {
                            options: [scopedMemberPortalOption(organization)],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/leden', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden',
                        expectedUrl: domain + '/nl-BE/leden/start',
                        expectedScope,
                        expectedLocator: '[data-testid="members-start-view"]',
                        expectedTopLeft: 'organization-logo',
                    });
                });

                test('/leden/start', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden/start',
                        expectedUrl: domain + '/nl-BE/leden/start',
                        expectedScope,
                        expectedLocator: '[data-testid="members-start-view"]',
                        expectedTopLeft: 'organization-logo',
                    });
                });

                test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                    const event = await new EventFactory({ organization }).create();

                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden/activiteiten/' + event.slug,
                        expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                        expectedScope,
                        expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                        expectedTopLeft: 'organization-logo',
                    });
                });

                test('/ should redirect to /leden/start', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden/start',
                        expectedUrl: domain + '/nl-BE/leden/start',
                        expectedScope,
                        expectedLocator: '[data-testid="members-start-view"]',
                        expectedTopLeft: 'organization-logo',
                    });
                });
            });

            test.describe('Unauthenticated user', () => {
                test.beforeEach(async ({ page }) => {
                    await logout({ page });
                });

                test('/beheerders/instellingen should show login view (scoped)', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/beheerders/instellingen',
                        expectedUrl: domain + '/nl-BE/beheerders',
                        expectedScope,
                        expectedLocator: '[data-testid="login-view"]',
                        // exception: dashboard context lets a logged-out visitor switch to the member portal
                        expectedTopLeft: {
                            options: [scopedMemberPortalOption(organization, organization.name, organization.address.anonymousString(organization.address.country))],
                            includeSearchOthers: true,
                        },
                    });
                });

                test('/leden should show login view (scoped)', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain + '/leden',
                        expectedUrl: domain + '/nl-BE/leden',
                        expectedScope,
                        expectedLocator: organization.meta.packages.useMembers ? '[data-testid="members-home-view"]' : '[data-testid="login-view"]',
                        expectedTopLeft: 'organization-logo', // Not allowed on custom domains if not signed in
                    });
                });

                test('/ should show auto login', async ({ page }) => {
                    await testRoute({
                        page,
                        user,
                        url: domain,
                        expectedUrl: domain + '/nl-BE',
                        expectedScope,
                        expectedLocator: organization.meta.packages.useMembers ? '[data-testid="members-home-view"]' : '[data-testid="login-view"]',
                        expectedTopLeft: 'organization-logo', // Not allowed on custom domains if not signed in
                    });
                });
            });
        });
    });

    test.describe('Single Organization mode', () => {
        let organization!: Organization;
        async function createOrganization() {
            const organization = await new OrganizationFactory({}).create();
            return organization;
        }

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            organization = await createOrganization();
            TestUtils.setPermanentEnvironment('singleOrganization', organization.id);
        });

        test.describe('Platform Admin', () => {
            let user: User;

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    globalPermissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/instellingen',
                    expectedScope: null,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        // single org + all options 'current' → no "search others" (suppressed by singleOrganization)
                        options: [adminOption, unscopedMemberPortalOption, otherOrgOptions(organization), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen redirects to /beheerders/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/<uri> redirects to /leden', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({ organization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/start',
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/ should show dashboard', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                    expectedTopLeft: {
                        options: [adminOption, unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging'), otherOrgOptions(membershipOrganization)],
                        includeSearchOthers: true,
                    },
                });
            });
        });

        test.describe('Full Organization Admin', () => {
            let user: User;

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.Full,
                    }),
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, otherOrgOptions(organization)],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/beheerders/<uri>/instellingen redirects to /beheerders/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/beheerders/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/activiteiten', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten',
                    expectedUrl: domain + '/nl-BE/leden/activiteiten',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="events-overview"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({ organization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/ should show dashboard', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption, dashboardOption(organization, 'Mijn vereniging')],
                        includeSearchOthers: false,
                    },
                });
            });
        });

        test.describe('Normal user', () => {
            let user: User;

            test.beforeEach(async ({ page }) => {
                user = await new UserFactory({
                    organization,
                    permissions: null,
                }).create();

                await loginAs({ user, page });
            });

            test('/platform/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/beheerders/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders/geen-toegang',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/' + organization.uri,
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/activiteiten', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten',
                    expectedUrl: domain + '/nl-BE/leden/activiteiten',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="events-overview"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/leden/activiteiten/<year>/<name>/<id>', async ({ page }) => {
                const event = await new EventFactory({ organization }).create();

                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten/' + event.slug,
                    expectedUrl: domain + '/nl-BE/leden/activiteiten/' + event.slug,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="event-view-' + event.id + '"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });

            test('/ should redirect to /leden/start (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: false,
                    },
                });
            });
        });

        test.describe('Unauthenticated user', () => {
            test.beforeEach(async ({ page }) => {
                await logout({ page });
            });

            test('/platform/instellingen should show login view (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/platform/instellingen',
                    expectedUrl: domain + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/beheerders/instellingen should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/beheerders/instellingen',
                    expectedUrl: domain + '/nl-BE/beheerders',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden',
                    expectedUrl: domain + '/nl-BE/leden',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/leden/activiteiten should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain + '/leden/activiteiten',
                    expectedUrl: domain + '/nl-BE/leden',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });

            test('/ should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: domain,
                    expectedUrl: domain + '/nl-BE',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                    expectedTopLeft: {
                        options: [unscopedMemberPortalOption],
                        includeSearchOthers: true,
                    },
                });
            });
        });
    });
});
