// test should always be imported first
import { test } from '../test-fixtures/base.js';

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { EmailTemplate, GroupFactory, OrganizationFactory, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import { EmailTemplateType, PermissionLevel, Permissions, STPackageStatus, STPackageType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';
import type { Pages } from '../helpers/index.js';

test.describe('Settings email templates', () => {
    let organization: Organization;
    let user: User;
    const organizationName = 'Settings Email Templates Org';
    const email = 'email-templates-settings@gmail.com';
    const password = 'testAbc123456';

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');

        organization = await new OrganizationFactory({
            name: organizationName,
        }).create();

        organization.meta.packages.packages.set(STPackageType.Members, STPackageStatus.create({
            startDate: new Date(),
        }));
        organization.meta.packages.packages.set(STPackageType.Webshops, STPackageStatus.create({
            startDate: new Date(),
        }));
        await organization.save();

        user = await new UserFactory({
            firstName: 'John',
            lastName: 'Doe',
            email,
            password,
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        await Token.createToken(user);
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test.beforeEach(async () => {
        const resetTypes: EmailTemplateType[] = [
            EmailTemplateType.RegistrationConfirmation,
            EmailTemplateType.RegistrationTransferDetails,
            EmailTemplateType.OrderConfirmationOnline,
            EmailTemplateType.OrderConfirmationTransfer,
            EmailTemplateType.DefaultMembersEmail,
        ];

        for (const type of resetTypes) {
            await EmailTemplate.delete().where('type', type).where('organizationId', organization.id);
            await EmailTemplate.delete().where('type', type).where('organizationId', null);
        }
    });

    async function login(page: Page, pages: Pages) {
        await pages.dashboard.goto();

        const searchInput = page.getByTestId('organization-search-input');
        await searchInput.click();
        await searchInput.fill(organizationName);

        await page.getByTestId('organization-button').first().click();

        await page.getByTestId('email-input').fill(email);
        await page.getByTestId('password-input').fill(password);
        await page.getByTestId('login-button').click();

        await expect(page.getByTestId('organization-name')).toContainText(organizationName);
    }

    function activePopup(page: Page) {
        return page.locator('div.popup.focused').last();
    }

    function editorJson(text: string) {
        return {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text,
                        },
                    ],
                },
            ],
        };
    }

    async function seedTemplate({
        type,
        subject,
        bodyText,
        organizationId = null,
        groupId = null,
        webshopId = null,
    }: {
        type: EmailTemplateType;
        subject: string;
        bodyText: string;
        organizationId?: string | null;
        groupId?: string | null;
        webshopId?: string | null;
    }) {
        const template = new EmailTemplate();
        template.subject = subject;
        template.type = type;
        template.organizationId = organizationId;
        template.groupId = groupId;
        template.webshopId = webshopId;
        template.text = bodyText;
        template.html = `<p>${bodyText}</p>`;
        template.json = editorJson(bodyText);
        await template.save();
        return template;
    }

    function appendEmailTemplatesRoute(url: string) {
        return `${url.replace(/\/+$/, '')}/email-templates`;
    }

    async function selectTab(page: Page, tabId: string) {
        const directTab = page.locator(`[data-testid="tab-button"][data-tab-id="${tabId}"]:visible`).first();
        if (await directTab.count() > 0) {
            await directTab.click();
            return;
        }

        const moreTab = page.locator('[data-testid="tab-button"][data-tab-id="more"]:visible').first();
        await moreTab.click();
        await page.locator(`[data-testid="tab-dropdown-item"][data-tab-id="${tabId}"]:visible`).first().click();
    }

    async function openSettingsEmailTemplates(page: Page) {
        await selectTab(page, 'settings');
        const route = appendEmailTemplatesRoute(page.url());

        const requestPromise = page.waitForRequest(request => request.method() === 'GET' && request.url().includes('/email-templates'));
        await Promise.all([
            requestPromise,
            page.goto(route),
        ]);

        await expect(activePopup(page).getByTestId('save-view')).toBeVisible();

        return await requestPromise;
    }

    async function openGroupEmailTemplates(page: Page) {
        const button = page.locator('[data-testid="group-email-templates-button"]:visible').first();
        await expect(button).toBeVisible();
        await button.click();
        await expect(activePopup(page).getByTestId('save-view')).toBeVisible();
    }

    async function openWebshopEmailTemplates(page: Page, webshopId: string) {
        await selectTab(page, 'webshops');
        await page.locator(`[data-testid="webshop-menu-item"][data-webshop-id="${webshopId}"]:visible`).first().click();
        const button = page.locator('[data-testid="webshop-email-templates-button"]:visible').first();
        await expect(button).toBeVisible();
        await button.click();
        await expect(activePopup(page).getByTestId('save-view')).toBeVisible();
    }

    async function clickTemplate(page: Page, type: EmailTemplateType) {
        await activePopup(page).locator(`[data-testid="email-template-item"][data-template-type="${type}"]:visible`).first().click();
    }

    async function createAndSaveTemplate(page: Page, subject: string) {
        const popup = activePopup(page);
        const subjectInput = popup.locator('#mail-subject');
        await expect(subjectInput).toBeVisible();
        await subjectInput.fill(subject);
        await popup.locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit());
        await expect(subjectInput).toHaveCount(0);
    }

    async function editTemplate(page: Page, newSubject: string) {
        const popup = activePopup(page);
        const subjectInput = popup.locator('#mail-subject');
        await expect(subjectInput).toBeVisible();
        await subjectInput.fill(newSubject);
        await popup.locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit());
        await expect(subjectInput).toHaveCount(0);
    }

    async function saveTemplateList(page: Page) {
        const popup = activePopup(page);
        await expect(popup.getByTestId('save-view')).toBeVisible();
        await popup.getByTestId('save-button').first().click();
        await expect(popup.getByTestId('save-view')).toHaveCount(0);
    }

    async function expectTemplateDefaults(page: Page, subject: string, bodyText: string) {
        const popup = activePopup(page);
        await expect(popup.locator('#mail-subject')).toHaveValue(subject);
        await expect(popup.locator('.ProseMirror').first()).toContainText(bodyText);
    }

    async function expectSingleTemplateInDatabase({
        type,
        organizationId,
        groupId,
        webshopId,
        expectedSubject,
        expectedText,
    }: {
        type: EmailTemplateType;
        organizationId: string | null;
        groupId: string | null;
        webshopId: string | null;
        expectedSubject: string;
        expectedText: string;
    }) {
        await expect.poll(async () => {
            const templates = await EmailTemplate.where({
                type,
                organizationId,
                groupId,
                webshopId,
            });

            return templates.map(t => ({
                id: t.id,
                subject: t.subject,
                text: t.text,
            }));
        }).toEqual([
            {
                id: expect.any(String),
                subject: expectedSubject,
                text: expectedText,
            },
        ]);
    }

    test('settings view requests organization templates without group/webshop filtering', async ({ page, pages }) => {
        await login(page, pages);

        const request = await openSettingsEmailTemplates(page);
        const url = new URL(request.url());
        const rawTypes = url.searchParams.get('types');
        const types = (rawTypes ?? '').split(',').filter(Boolean) as EmailTemplateType[];

        expect(url.searchParams.has('groupIds')).toBe(false);
        expect(url.searchParams.has('webshopId')).toBe(false);
        if (rawTypes !== null) {
            expect(types).toContain(EmailTemplateType.SavedMembersEmail);
        }
    });

    test('group settings can create a new email template override', async ({ page, pages }) => {
        const group = await new GroupFactory({ organization }).create();
        const organizationPeriod = await organization.getPeriod();
        organizationPeriod.settings.rootCategory?.groupIds.push(group.id);
        await organizationPeriod.save();
        await login(page, pages);

        await pages.groupOverview({ group, organization }).goto();
        await openGroupEmailTemplates(page);

        await clickTemplate(page, EmailTemplateType.RegistrationConfirmation);
        await createAndSaveTemplate(page, 'Group override subject');
        await saveTemplateList(page);

        await expectSingleTemplateInDatabase({
            type: EmailTemplateType.RegistrationConfirmation,
            organizationId: organization.id,
            groupId: group.id,
            webshopId: null,
            expectedSubject: 'Group override subject',
            expectedText: '',
        });

        await openGroupEmailTemplates(page);
        await clickTemplate(page, EmailTemplateType.RegistrationConfirmation);
        await expect(activePopup(page).locator('#mail-subject')).toHaveValue('Group override subject');
    });

    test('group settings can edit an existing overridden email template', async ({ page, pages }) => {
        const group = await new GroupFactory({ organization }).create();
        const organizationPeriod = await organization.getPeriod();
        organizationPeriod.settings.rootCategory?.groupIds.push(group.id);
        await organizationPeriod.save();
        const existingSubject = 'Existing group override';
        const template = new EmailTemplate();
        template.subject = existingSubject;
        template.type = EmailTemplateType.RegistrationConfirmation;
        template.organizationId = organization.id;
        template.groupId = group.id;
        template.html = '<p>group override</p>';
        template.text = 'group override';
        template.json = {};
        await template.save();

        await login(page, pages);
        await pages.groupOverview({ group, organization }).goto();
        await openGroupEmailTemplates(page);

        await clickTemplate(page, EmailTemplateType.RegistrationConfirmation);
        await editTemplate(page, 'Updated group override');
        await saveTemplateList(page);

        await expect.poll(async () => {
            await template.refresh();
            return template.subject;
        }).toBe('Updated group override');

        await expect.poll(async () => {
            const groupTemplates = await EmailTemplate.where({
                type: EmailTemplateType.RegistrationConfirmation,
                organizationId: organization.id,
                groupId: group.id,
                webshopId: null,
            });

            return groupTemplates.map(t => t.id).sort();
        }).toEqual([template.id]);

        await openGroupEmailTemplates(page);
        await clickTemplate(page, EmailTemplateType.RegistrationConfirmation);
        await expect(page.locator('#mail-subject')).toHaveValue('Updated group override');
    });

    test('webshop settings can create a new email template override', async ({ page, pages }) => {
        const webshop = await new WebshopFactory({ organizationId: organization.id, name: 'Settings Webshop Create' }).create();
        await login(page, pages);

        await openWebshopEmailTemplates(page, webshop.id);

        await clickTemplate(page, EmailTemplateType.OrderConfirmationOnline);
        await createAndSaveTemplate(page, 'Webshop override subject');
        await saveTemplateList(page);

        await expectSingleTemplateInDatabase({
            type: EmailTemplateType.OrderConfirmationOnline,
            organizationId: organization.id,
            groupId: null,
            webshopId: webshop.id,
            expectedSubject: 'Webshop override subject',
            expectedText: '',
        });

        await openWebshopEmailTemplates(page, webshop.id);
        await clickTemplate(page, EmailTemplateType.OrderConfirmationOnline);
        await expect(activePopup(page).locator('#mail-subject')).toHaveValue('Webshop override subject');
    });

    test('webshop settings can edit an existing overridden email template', async ({ page, pages }) => {
        const webshop = await new WebshopFactory({ organizationId: organization.id, name: 'Settings Webshop Edit' }).create();
        const existingSubject = 'Existing webshop override';
        const template = new EmailTemplate();
        template.subject = existingSubject;
        template.type = EmailTemplateType.OrderConfirmationOnline;
        template.organizationId = organization.id;
        template.webshopId = webshop.id;
        template.html = '<p>webshop override</p>';
        template.text = 'webshop override';
        template.json = {};
        await template.save();

        await login(page, pages);
        await openWebshopEmailTemplates(page, webshop.id);

        await clickTemplate(page, EmailTemplateType.OrderConfirmationOnline);
        await editTemplate(page, 'Updated webshop override');
        await saveTemplateList(page);

        await expect.poll(async () => {
            await template.refresh();
            return template.subject;
        }).toBe('Updated webshop override');

        await expect.poll(async () => {
            const webshopTemplates = await EmailTemplate.where({
                type: EmailTemplateType.OrderConfirmationOnline,
                organizationId: organization.id,
                groupId: null,
                webshopId: webshop.id,
            });

            return webshopTemplates.map(t => t.id).sort();
        }).toEqual([template.id]);

        await openWebshopEmailTemplates(page, webshop.id);
        await clickTemplate(page, EmailTemplateType.OrderConfirmationOnline);
        await expect(page.locator('#mail-subject')).toHaveValue('Updated webshop override');
    });

    test('group new template inherits organization defaults', async ({ page, pages }) => {
        const group = await new GroupFactory({ organization }).create();
        const organizationPeriod = await organization.getPeriod();
        organizationPeriod.settings.rootCategory?.groupIds.push(group.id);
        await organizationPeriod.save();

        await seedTemplate({
            type: EmailTemplateType.RegistrationConfirmation,
            organizationId: organization.id,
            subject: 'Org registration subject',
            bodyText: 'Org registration body',
        });

        await login(page, pages);
        await pages.groupOverview({ group, organization }).goto();
        await openGroupEmailTemplates(page);
        await clickTemplate(page, EmailTemplateType.RegistrationConfirmation);

        await expectTemplateDefaults(page, 'Org registration subject', 'Org registration body');
        await activePopup(page).locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit());
        await saveTemplateList(page);

        await expectSingleTemplateInDatabase({
            type: EmailTemplateType.RegistrationConfirmation,
            organizationId: organization.id,
            groupId: group.id,
            webshopId: null,
            expectedSubject: 'Org registration subject',
            expectedText: 'Org registration body',
        });
    });

    test('group new template inherits platform defaults when organization defaults missing', async ({ page, pages }) => {
        const group = await new GroupFactory({ organization }).create();
        const organizationPeriod = await organization.getPeriod();
        organizationPeriod.settings.rootCategory?.groupIds.push(group.id);
        await organizationPeriod.save();

        await seedTemplate({
            type: EmailTemplateType.RegistrationConfirmation,
            subject: 'Platform registration subject',
            bodyText: 'Platform registration body',
        });

        await login(page, pages);
        await pages.groupOverview({ group, organization }).goto();
        await openGroupEmailTemplates(page);
        await clickTemplate(page, EmailTemplateType.RegistrationConfirmation);

        await expectTemplateDefaults(page, 'Platform registration subject', 'Platform registration body');
        await activePopup(page).locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit());
        await saveTemplateList(page);

        await expectSingleTemplateInDatabase({
            type: EmailTemplateType.RegistrationConfirmation,
            organizationId: organization.id,
            groupId: group.id,
            webshopId: null,
            expectedSubject: 'Platform registration subject',
            expectedText: 'Platform registration body',
        });
    });

    test('webshop new template inherits organization defaults', async ({ page, pages }) => {
        const webshop = await new WebshopFactory({ organizationId: organization.id, name: 'Inherit org webshop' }).create();

        await seedTemplate({
            type: EmailTemplateType.OrderConfirmationOnline,
            organizationId: organization.id,
            subject: 'Org webshop subject',
            bodyText: 'Org webshop body',
        });

        await login(page, pages);
        await openWebshopEmailTemplates(page, webshop.id);
        await clickTemplate(page, EmailTemplateType.OrderConfirmationOnline);

        await expectTemplateDefaults(page, 'Org webshop subject', 'Org webshop body');
        await activePopup(page).locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit());
        await saveTemplateList(page);

        await expectSingleTemplateInDatabase({
            type: EmailTemplateType.OrderConfirmationOnline,
            organizationId: organization.id,
            groupId: null,
            webshopId: webshop.id,
            expectedSubject: 'Org webshop subject',
            expectedText: 'Org webshop body',
        });
    });

    test('webshop new template inherits platform defaults when organization defaults missing', async ({ page, pages }) => {
        const webshop = await new WebshopFactory({ organizationId: organization.id, name: 'Inherit platform webshop' }).create();

        await seedTemplate({
            type: EmailTemplateType.OrderConfirmationOnline,
            subject: 'Platform webshop subject',
            bodyText: 'Platform webshop body',
        });

        await login(page, pages);
        await openWebshopEmailTemplates(page, webshop.id);
        await clickTemplate(page, EmailTemplateType.OrderConfirmationOnline);

        await expectTemplateDefaults(page, 'Platform webshop subject', 'Platform webshop body');
        await activePopup(page).locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit());
        await saveTemplateList(page);

        await expectSingleTemplateInDatabase({
            type: EmailTemplateType.OrderConfirmationOnline,
            organizationId: organization.id,
            groupId: null,
            webshopId: webshop.id,
            expectedSubject: 'Platform webshop subject',
            expectedText: 'Platform webshop body',
        });
    });

    test('organization new template inherits platform defaults', async ({ page, pages }) => {
        await seedTemplate({
            type: EmailTemplateType.DefaultMembersEmail,
            subject: 'Platform organization subject',
            bodyText: 'Platform organization body',
        });

        await login(page, pages);
        await openSettingsEmailTemplates(page);
        await clickTemplate(page, EmailTemplateType.DefaultMembersEmail);

        await expectTemplateDefaults(page, 'Platform organization subject', 'Platform organization body');
        await activePopup(page).locator('form').first().evaluate((form: HTMLFormElement) => form.requestSubmit());
        await saveTemplateList(page);

        await expectSingleTemplateInDatabase({
            type: EmailTemplateType.DefaultMembersEmail,
            organizationId: organization.id,
            groupId: null,
            webshopId: null,
            expectedSubject: 'Platform organization subject',
            expectedText: 'Platform organization body',
        });
    });
});
