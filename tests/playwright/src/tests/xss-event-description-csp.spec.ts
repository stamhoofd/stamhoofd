// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import {
    EventFactory,
    OrganizationFactory,
    Token,
    UserFactory,
} from '@stamhoofd/models';
import {
    EventMeta,
    PermissionLevel,
    Permissions,
    RichText,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { DashboardTab, WorkerData } from '../helpers/index.js';

/**
 * The event description is rich text stored as raw HTML and rendered with Vue's
 * v-html (the dashboard EventOverview and the public member-portal EventView share
 * this exact render path). v-html does NOT sanitize, so a malicious description
 * that ends up in the database is inserted verbatim into the DOM.
 *
 * Our last line of defense is the Content-Security-Policy in the web-app's
 * index.html: `script-src 'self' 'sha256-...'` (no 'unsafe-inline'). It blocks
 * inline event handlers such as `<img onerror>`, so even a stored XSS payload
 * never executes.
 *
 * This test injects such a payload straight into the database (bypassing any
 * input-side sanitisation), opens the event in the dashboard, and verifies:
 *  - the payload reaches the DOM verbatim, so the browser really tried to run it
 *  - the inline handler never executes (the marker flag stays false)
 *  - the CSP reports a script-src violation for the blocked handler
 */
test.describe('Stored XSS in event description is blocked by CSP @xss', () => {
    const password = 'testAbc123456';

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedEventWithXss(options: { seedId: string }) {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        const runId = `${WorkerData.id}-${options.seedId}-${uniqueId}`;
        const organizationUri = `xss-organization-${runId}`;
        const email = `xss-${runId}@test.be`;
        const marker = `xss-${runId}`;
        const descriptionText = `Safe description ${marker}`;

        // A realistic stored-XSS payload: an image whose load fails, triggering an
        // inline onerror handler. Without CSP this handler would run arbitrary JS.
        const descriptionHtml = `<p>${descriptionText}</p>`
            + `<img src="/missing-${marker}.png" onerror="window.__xssExecuted = true; document.title = 'XSS-EXECUTED';">`;

        const organization: Organization = await new OrganizationFactory({
            name: `XSS Organization ${runId}`,
            uri: organizationUri,
        }).create();

        const user: User = await new UserFactory({
            firstName: 'John',
            lastName: 'Doe',
            email,
            password,
            organization,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        await Token.createToken(user);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(10, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(12, 0, 0, 0);

        const eventName = `XSS event ${runId}`;

        await new EventFactory({
            organization,
            name: eventName,
            startDate,
            endDate,
            meta: EventMeta.create({
                visible: true,
                description: RichText.create({
                    html: descriptionHtml,
                    text: descriptionText,
                }),
            }),
        }).create();

        return { organizationUri, email, eventName, descriptionText, marker };
    }

    test('injected inline event handler does not execute and triggers a CSP violation', async ({ page, pages }) => {
        const scenario = await seedEventWithXss({ seedId: 'event-description' });

        // Capture CSP violations reported to the console (a stable, engine-level
        // signal that the browser refused to run something because of the policy).
        const cspConsoleMessages: string[] = [];
        page.on('console', (msg) => {
            if (/content security policy/i.test(msg.text())) {
                cspConsoleMessages.push(msg.text());
            }
        });

        // Record the DOM securitypolicyviolation events and the XSS marker before
        // any page script runs. addInitScript re-runs on every full navigation, so
        // the listener is guaranteed to be in place when the description renders.
        await page.addInitScript(() => {
            (window as unknown as { __xssExecuted: boolean }).__xssExecuted = false;
            const violations: { violatedDirective: string; effectiveDirective: string; blockedURI: string }[] = [];
            (window as unknown as { __cspViolations: typeof violations }).__cspViolations = violations;
            document.addEventListener('securitypolicyviolation', (event) => {
                violations.push({
                    violatedDirective: event.violatedDirective,
                    effectiveDirective: (event as SecurityPolicyViolationEvent & { effectiveDirective?: string }).effectiveDirective ?? '',
                    blockedURI: event.blockedURI,
                });
            });
        });

        await pages.dashboard.login({
            organizationUri: scenario.organizationUri,
            email: scenario.email,
            password,
        });

        await pages.dashboard.openTab(DashboardTab.Events);
        await expect(page.locator('#settings-view')).toBeVisible();

        // Open the event so its description is rendered through v-html.
        await page.locator('#settings-view .st-list-item:visible h3 span')
            .filter({ hasText: scenario.eventName })
            .click();

        const overview = page.locator('.event-overview:visible');
        await expect(overview).toBeVisible();

        // The payload reaches the DOM verbatim: the safe text is shown and the
        // malicious <img onerror> element is present (CSP only blocks execution, it
        // does not strip the attribute).
        await expect(overview.locator('.description')).toContainText(scenario.descriptionText);
        await expect(overview.locator(`img[src*="missing-${scenario.marker}"]`)).toHaveCount(1);

        // The browser tried to run the inline handler and the CSP blocked it. Accept
        // either the DOM violation event or the console violation as proof.
        await expect.poll(async () => {
            const domViolation = await page.evaluate(() => {
                const violations = (window as unknown as { __cspViolations: { violatedDirective: string; effectiveDirective: string }[] }).__cspViolations;
                return violations.some(v => `${v.violatedDirective} ${v.effectiveDirective}`.includes('script-src'));
            });
            return domViolation || cspConsoleMessages.length > 0;
        }, { message: 'Expected a CSP violation for the blocked inline event handler' }).toBe(true);

        // The injected code never ran.
        expect(await page.evaluate(() => (window as unknown as { __xssExecuted: boolean }).__xssExecuted)).toBe(false);
    });
});
