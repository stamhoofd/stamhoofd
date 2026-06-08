import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, STPackageStatus, STPackageType, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { test } from '../../test-fixtures/base.js';
import { CaddyConfigHelper } from '../../setup/helpers/CaddyConfigHelper.js';
import { WorkerData } from '../index.js';

const USER_PASSWORD = 'testAbc123456';

// Single timeout for all waits/assertions in this file, kept under the 30s default test timeout.
const TIMEOUT_MS = 15_000;

/**
 * Register a routing scenario as a Playwright suite: configure the environment, create the
 * organization and user, then test the initial navigation and each follow-up step as its own
 * test (so a failure names exactly which step broke).
 *
 * - `initialPath` / `initialExpectedElements`: navigate there and assert every listed marker is
 *   present (e.g. the app root plus the platform/organization logo or organization switcher).
 * - `clickInstructions`: from the initial page, perform a sequence of clicks (a tab, or any
 *   element by test id such as the organization switcher and one of its app options), then
 *   assert the expected element(s). When `expectedPath` is given, also assert the resulting
 *   path and that a refresh lands on the same path with the same element(s).
 */
export function runRoutingScenario(scenario: {
    name: string;
    userMode: 'platform' | 'organization';
    singleOrganization: boolean;
    user: 'global' | 'organization' | 'none' | 'unauthenticated';
    host: 'dashboard' | 'organizationDomain';
    initialPath: string | ((orgUri: string | null) => string);
    initialExpectedElements: string[];
    clickInstructions?: {
        name: string;
        // Clicks to perform in order: a tab (by data-tab-id) or any element by test id.
        clicks: ({ tab: string } | { testId: string })[];
        expectedPath?: string | ((orgUri: string | null) => string);
        expectedElements: string[];
    }[];
}) {
    test.describe(scenario.name, () => {
        let organization: Organization;
        let tokenString: string | null = null;
        let tokenKey: string | null = null;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', scenario.userMode);

            organization = await new OrganizationFactory({
                name: `${scenarioSlug(scenario.name)}-${WorkerData.id}`,
                domain: scenario.host === 'organizationDomain'
                    ? CaddyConfigHelper.getOrgDomain(WorkerData.id!)
                    : undefined,
            }).create();

            // Enable packages so the dashboard renders its real (multi-tab) views.
            organization.meta.packages.packages.set(STPackageType.Members, STPackageStatus.create({ startDate: new Date() }));
            organization.meta.packages.packages.set(STPackageType.Webshops, STPackageStatus.create({ startDate: new Date() }));
            await organization.save();

            TestUtils.setPermanentEnvironment(
                'singleOrganization',
                scenario.singleOrganization ? organization.id : undefined,
            );

            const user = await createScenarioUser(scenario.user, scenario.name, organization);
            if (user) {
                tokenString = await createTokenString(user);
                // A global user authenticates the platform session; org/none users authenticate
                // the session that the organization-scoped routes use.
                tokenKey = scenario.user === 'global'
                    ? tokenStorageKey({ userMode: 'platform' })
                    : tokenStorageKey({ userMode: scenario.userMode, organizationId: organization.id });
            }
        });

        test.afterAll(async () => {
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);
            await WorkerData.resetDatabase();
        });

        test.beforeEach(async ({ page }) => {
            if (tokenString && tokenKey) {
                await authenticate(page, tokenKey, tokenString);
            }
        });

        const host = () => scenario.host === 'organizationDomain'
            ? WorkerData.urls.orgDomain
            : WorkerData.urls.dashboard;

        const resolvePath = (path: string | ((orgUri: string | null) => string)) =>
            typeof path === 'function' ? path(organization.uri) : path;

        // Wait until one of the given app-root / element markers is attached to the DOM.
        const waitForAny = async (page: Page, ids: string[]) => {
            await page
                .locator(ids.map(id => `[data-testid="${id}"]`).join(', '))
                .first()
                .waitFor({ state: 'attached', timeout: TIMEOUT_MS });
        };

        // Wait until all of the given markers are attached to the DOM.
        const waitForAll = async (page: Page, ids: string[]) => {
            for (const id of ids) {
                await page.locator(`[data-testid="${id}"]`).first().waitFor({ state: 'attached', timeout: TIMEOUT_MS });
            }
        };

        const openInitial = async (page: Page) => {
            await page.goto(host() + resolvePath(scenario.initialPath));
            await waitForAll(page, scenario.initialExpectedElements);
        };

        test('initial navigation', async ({ page }) => {
            await openInitial(page);
        });

        for (const click of scenario.clickInstructions ?? []) {
            test(click.name, async ({ page }) => {
                await openInitial(page);

                for (const target of click.clicks) {
                    const locator = 'tab' in target
                        ? page.locator(`[data-testid="tab-button"][data-tab-id="${target.tab}"]`)
                        : page.getByTestId(target.testId);
                    await locator.click();
                }

                if (click.expectedPath === undefined) {
                    await waitForAny(page, click.expectedElements);
                    return;
                }

                const expectedPath = resolvePath(click.expectedPath);
                await expect.poll(() => new URL(page.url()).pathname, { timeout: TIMEOUT_MS }).toBe(expectedPath);
                await waitForAny(page, click.expectedElements);

                // A refresh must land on the same path with the same element(s).
                await page.reload();
                await expect.poll(() => new URL(page.url()).pathname, { timeout: TIMEOUT_MS }).toBe(expectedPath);
                await waitForAny(page, click.expectedElements);
            });
        }
    });
}

/**
 * Create the localStorage token value the frontend expects under `token-<suffix>`.
 * @see SessionContext.loadTokenFromStorage
 */
async function createTokenString(user: User): Promise<string> {
    const token = await Token.createToken(user);
    return JSON.stringify(new TokenStruct(token).encode({ version: Version }));
}

/**
 * The localStorage key the frontend reads the token from depends on the user mode:
 * - platform mode always uses `token-platform`
 * - organization mode uses `token-<organizationId>`
 * @see SessionContext.loadTokenFromStorage
 */
function tokenStorageKey(options: { userMode: 'platform' | 'organization'; organizationId?: string }): string {
    if (options.userMode === 'platform') {
        return 'token-platform';
    }
    if (!options.organizationId) {
        throw new Error('organizationId is required for organization mode token storage key');
    }
    return `token-${options.organizationId}`;
}

/**
 * Inject an authentication token into localStorage before any app script runs.
 * Must be called before navigating. Works for any origin (dashboard or org domain)
 * because the init script runs on every navigation in this context.
 */
async function authenticate(page: Page, tokenKey: string, tokenString: string) {
    await page.addInitScript(
        ([key, value]) => {
            window.localStorage.setItem(key, value);
        },
        [tokenKey, tokenString] as [string, string],
    );
}

function scenarioSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Create a user with the requested permissions:
 * - `global`: a platform user with global permissions (for the admin app)
 * - `organization`: a member of the organization with full org permissions (for the dashboard)
 * - `none`: a member of the organization without any permissions
 */
async function makeUser(
    permissions: 'global' | 'organization' | 'none',
    email: string,
    organization: Organization,
): Promise<User> {
    const base = { firstName: 'Routing', lastName: 'Tester', email, password: USER_PASSWORD };

    if (permissions === 'global') {
        return new UserFactory({
            ...base,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    }

    return new UserFactory({
        ...base,
        organization,
        permissions: permissions === 'organization'
            ? Permissions.create({ level: PermissionLevel.Full })
            : undefined,
    }).create();
}

async function createScenarioUser(
    user: 'global' | 'organization' | 'none' | 'unauthenticated',
    scenarioName: string,
    organization: Organization,
): Promise<User | null> {
    if (user === 'unauthenticated') {
        return null;
    }
    return makeUser(user, `routing-${scenarioSlug(scenarioName)}-${WorkerData.id}@example.com`, organization);
}
