import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Platform, Token, UserFactory } from '@stamhoofd/models';
import type { AppType } from '@stamhoofd/structures';
import { PermissionLevel, Permissions, PlatformEventType, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/worker/WorkerData.js';
import { test } from '../test-fixtures/base.js';
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

async function testRoute({ page, ...options }: {
    user: User | null;
    page: Page;
    url: string;
    expectedUrl: string;
    expectedScope: Organization | null;
    expectedLocator: string;
    expectedSwitcher?: boolean;
    expectedSwitchOptions?: { app: AppType; organization: Organization | null }[];
}) {
    if (!options.expectedSwitcher && options.expectedSwitchOptions) {
        throw new Error('Invaid usage NOT expectedSwitcher with expectedSwitchOptions');
    }

    await page.goto(options.url);

    // Settings view should be visible
    await expect(page.locator(options.expectedLocator)).toBeVisible();
    await checkScopedTo({ page, organization: options.expectedScope });

    // Url will only get updated after a certain timeout
    await page.waitForTimeout(5_000);

    // Url should be the same
    await expect(page).toHaveURL(options.expectedUrl);

    // Todo: check switcher left top
    if (options.expectedSwitcher) {
        // Todo: click switcher. Check options.
    } else {
        // Todo: check no switcher left top
    }
}

test.describe('Routing on page load @routing', () => {
    /**
     * Default if not set.
     */
    const user = null;
    let membershipOrganization!: Organization;

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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/instellingen',
                    expectedScope: null,
                    expectedLocator: '#settings-view',
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                const organization = await new OrganizationFactory({
                }).create();

                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                const organization = await new OrganizationFactory({
                }).create();

                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/ should show organization search', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test.fixme('/ should redirect to /beheerders/<uri>/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen should redirect to start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test.fixme('/ should redirect to /beheerders/<uri>/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/geen-toegang',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test.fixme('/ should redirect to /leden/start (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: null,
                    expectedLocator: '[data-testid="members-start-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/leden/<uri> should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/leden/start should show login view (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/ should show login view (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/instellingen',
                    expectedScope: null,
                    expectedLocator: '#settings-view',
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                const organization = await createOrganization();

                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                const organization = await createOrganization();

                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start redirects to selection', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                });
            });

            test('/ should show organization search', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start should redirect to selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                });
            });

            test('/ should show selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri + '/geen-toegang',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri + '/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start should redirect to selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                });
            });

            test('/ should redirect to selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/leden/<uri> should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/' + organization.uri,
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/leden/start should redirect to organization selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
                });
            });

            test('/ should show organization selection view', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: null,
                    expectedLocator: '[data-testid="organization-selection-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/instellingen',
                    expectedScope: null,
                    expectedLocator: '#settings-view',
                });
            });

            test('/beheerders/<uri>/instellingen redirects to /beheerders/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                });
            });

            test('/beheerders/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                });
            });

            test('/leden/<uri> redirects to /leden', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/start',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/ should show dashboard', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/beheerders/<uri>/instellingen redirects to /beheerders/start', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/' + organization.uri + '/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
                });
            });

            test('/beheerders/instellingen', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/instellingen',
                    expectedScope: organization,
                    expectedLocator: '#settings-view',
                });
            });

            test('/leden/<uri>', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/activiteiten', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/activiteiten',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/activiteiten',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="events-overview"]',
                });
            });

            test('/ should show dashboard', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="dashboard-start-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform/geen-toegang',
                    expectedScope: null,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/beheerders/instellingen should show permissions error page', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders/geen-toegang',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="no-permissions-view"]',
                });
            });

            test('/leden', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/' + organization.uri,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
                });
            });

            test('/leden/activiteiten', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/activiteiten',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/activiteiten',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="events-overview"]',
                });
            });

            test('/ should redirect to /leden/start (unscoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden/start',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="members-start-view"]',
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
                    url: WorkerData.urls.dashboard + '/platform/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/platform',
                    expectedScope: null,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/beheerders/instellingen should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/beheerders/instellingen',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/beheerders',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/leden should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/leden/activiteiten should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard + '/leden/activiteiten',
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE/leden',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });

            test('/ should show login view (scoped)', async ({ page }) => {
                await testRoute({
                    page,
                    user,
                    url: WorkerData.urls.dashboard,
                    expectedUrl: WorkerData.urls.dashboard + '/nl-BE',
                    expectedScope: organization,
                    expectedLocator: '[data-testid="login-view"]',
                });
            });
        });
    });
});
