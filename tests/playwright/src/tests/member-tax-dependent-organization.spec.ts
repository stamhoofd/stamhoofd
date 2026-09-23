// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Group, Organization, User } from '@stamhoofd/models';
import { GroupFactory, Member, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriod, UserFactory } from '@stamhoofd/models';
import { Address, appToUri, BooleanStatus, GroupCategory, GroupCategorySettings, MemberDetails, NationalRegisterNumberOptOut, OrganizationMetaData, OrganizationRecordsConfiguration, OrganizationType, Parent, ParentType, PermissionLevel, Permissions, PropertyFilter, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Organization as OrganizationModel } from '@stamhoofd/models';
import { WorkerData } from '../helpers/index.js';

type Scenario = {
    organization: Organization;
    group: Group;
    user: User;
    /** Two siblings that share the same parents */
    memberA: Member;
    memberB: Member;
    portalUser: User;
    /** The shared parent, present on both siblings with the same id */
    motherId: string;
    fatherId: string;
    names: { memberA: string; memberB: string; mother: string; father: string; thirdParent: string };
};

const PORTAL_PASSWORD = 'testAbc123456';

// Valid Belgian national register numbers: the last two digits are the checksum 97 - (rest % 97)
const VALID_NRN_A = '93042000122';
const VALID_NRN_B = '93042000221';

// Members need a valid number of their own: the general step validates it, and it has to match the birth day
const YOUNG = { birthDay: new Date(2015, 3, 20), nationalRegisterNumber: '15042000162' };
const TOO_OLD = { birthDay: new Date(2008, 3, 20), nationalRegisterNumber: '08042000112' };
// Over 14, but a severe disability raises the limit to 21
const DISABLED = { birthDay: new Date(2007, 3, 20), nationalRegisterNumber: '07042000188', severeDisability: true };

test.describe('Tax dependent parents (organization mode) @tax-dependent', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario({ taxCertificates, nationalRegisterNumbers, profile = YOUNG, taxDependentParents = {}, withThirdParent = false, withRegistrations = true, taxDependentPerMember, memberNationalRegisterNumberFilter = true }: {
        /** The organization setting that collects data for fiscal certificates */
        taxCertificates: boolean;
        /** National register number per parent, null to leave it empty */
        nationalRegisterNumbers: { mother: string | null; father: string | null };
        /** Young enough for a fiscal certificate, too old, or kept eligible by a severe disability */
        profile?: { birthDay: Date; nationalRegisterNumber: string; severeDisability?: boolean };
        /** Parents that already have the member tax dependent */
        taxDependentParents?: { mother?: boolean; father?: boolean };
        /** Adds a third parent, to reach the maximum of two tax dependent parents */
        withThirdParent?: boolean;
        /** Leave the members unregistered, so the portal can register them for the first time */
        withRegistrations?: boolean;
        /** Tax dependent parents per member, for families where the siblings differ */
        taxDependentPerMember?: {
            memberA?: { mother?: boolean | null; father?: boolean | null };
            memberB?: { mother?: boolean | null; father?: boolean | null };
        };
        /** The plain national register number question, which the UI cannot turn off on its own */
        memberNationalRegisterNumberFilter?: boolean;
    }): Promise<Scenario> {
        const runId = `${WorkerData.id}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `Tax Dependent Organization ${runId}`,
            uri: `tax-dependent-${runId}`,
            packages: [STPackageBundle.Members],
            meta: OrganizationMetaData.create({
                type: OrganizationType.Youth,
                umbrellaOrganization: null,
                defaultEndDate: new Date(),
                defaultStartDate: new Date(),
                defaultPrices: [],
                recordsConfiguration: OrganizationRecordsConfiguration.create({
                    parents: PropertyFilter.createDefault(),
                    birthDay: PropertyFilter.createDefault(),
                    nationalRegisterNumber: memberNationalRegisterNumberFilter ? PropertyFilter.createDefault() : null,
                    taxCertificates,
                }),
            }),
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const period = await RegistrationPeriod.getByID(organization.periodId);
        if (!period) {
            throw new Error('Missing registration period for organization');
        }

        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period,
        }).create();

        const group = await new GroupFactory({
            organization,
            period,
            name: new TranslatedString('Kapoenen'),
        }).create();

        // The factory closes the group ten seconds after creation, too short to register through the UI
        const openUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        group.settings.endDate = openUntil;
        group.settings.registrationEndDate = openUntil;
        await group.save();

        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [group.id],
        });
        organizationPeriod.settings.categories.push(category);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
        await organizationPeriod.save();

        const names = {
            memberA: `Anna-${runId}`,
            memberB: `Bram-${runId}`,
            mother: `Moeder-${runId}`,
            father: `Vader-${runId}`,
            thirdParent: `Plusouder-${runId}`,
        };

        // The same parent objects (same ids) on both siblings, like the backend merge produces
        // The member portal requires a phone, email and address on every parent
        const address = Address.create({
            street: 'Teststraat',
            number: '1',
            postalCode: '9000',
            city: 'Gent',
            country: Country.Belgium,
        });

        const mother = Parent.create({
            type: ParentType.Mother,
            firstName: names.mother,
            lastName: 'Doe',
            email: `moeder-${runId}@example.com`,
            phone: '+32470123456',
            address,
            isMemberTaxDependent: taxDependentParents.mother ?? null,
            nationalRegisterNumber: nationalRegisterNumbers.mother,
        });
        const father = Parent.create({
            type: ParentType.Father,
            firstName: names.father,
            lastName: 'Doe',
            email: `vader-${runId}@example.com`,
            phone: '+32470123457',
            address,
            isMemberTaxDependent: taxDependentParents.father ?? null,
            nationalRegisterNumber: nationalRegisterNumbers.father,
        });

        const thirdParent = Parent.create({
            type: ParentType.Other,
            firstName: names.thirdParent,
            lastName: 'Doe',
            email: `plusouder-${runId}@example.com`,
            phone: '+32470123458',
            address,
        });

        // Both members have to share a user: Member.getFamily joins on _members_users,
        // so without one they are not a family and the parent data never merges between them
        const portalUser = await new UserFactory({
            organization,
            email: `portal-${runId}@example.com`,
            password: PORTAL_PASSWORD,
        }).create();

        const buildMember = async (firstName: string, ownTaxDependentParents?: { mother?: boolean | null; father?: boolean | null }) => {
            const memberMother = mother.clone();
            const memberFather = father.clone();

            // isMemberTaxDependent lives on the member's own copy of the parent, so it can differ per member
            if (ownTaxDependentParents) {
                memberMother.isMemberTaxDependent = ownTaxDependentParents.mother ?? null;
                memberFather.isMemberTaxDependent = ownTaxDependentParents.father ?? null;
            }

            const member = await new MemberFactory({
                organization,
                user: portalUser,
                details: MemberDetails.create({
                    firstName,
                    lastName: 'Doe',
                    birthDay: profile.birthDay,
                    // Valid and complete, so the parents step is the one that needs work
                    nationalRegisterNumber: profile.nationalRegisterNumber,
                    severeDisability: profile.severeDisability === undefined ? null : BooleanStatus.create({ value: profile.severeDisability }),
                    parents: withThirdParent ? [memberMother, memberFather, thirdParent.clone()] : [memberMother, memberFather],
                }),
            }).create();

            if (withRegistrations) {
                // A registration in the current period keeps the member eligible for a fiscal certificate
                await new RegistrationFactory({ member, group }).create();
            }
            return member;
        };

        const memberA = await buildMember(names.memberA, taxDependentPerMember?.memberA);
        const memberB = await buildMember(names.memberB, taxDependentPerMember?.memberB);

        const user = await new UserFactory({
            firstName: 'Tax',
            lastName: 'Admin',
            email: `tax-admin-${runId}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        return { organization, group, user, memberA, memberB, motherId: mother.id, fatherId: father.id, names, portalUser };
    }

    async function loginAs({ page, user }: { page: Page; user: User }) {
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        const organizationId = user.organizationId;

        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });
    }

    /** Opens the members list, reloading the dashboard */
    async function openMembersList({ page, scenario }: { page: Page; scenario: Scenario }) {
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu).toBeVisible({ timeout: 30_000 });

        // The full list lives behind 'Meer' in the members menu
        await membersMenu.locator('button.menu-button', { hasText: 'Meer' }).click();
        const allMembers = page.getByTestId('context-menu-item-title').filter({ hasText: 'Alle leden (alle werkjaren)' });
        await expect(allMembers).toBeVisible();
        await allMembers.click();

        await expect(page.getByTestId('table-row').first()).toBeVisible({ timeout: 30_000 });
    }

    /** Closes the member detail view that a table row opened, so the list is clickable again */
    async function closeMemberDetailView({ page }: { page: Page }) {
        const detail = page.locator('.member-segmented-view');

        if (await detail.first().isVisible().catch(() => false)) {
            await detail.first().getByTestId('close-button').first().click();
            await expect(detail.first()).toBeHidden({ timeout: 15_000 });
        }
    }

    /** Opens a member's edit view from the list that is already on screen, without reloading */
    async function openMemberEditViewFromList({ page, memberName }: { page: Page; memberName: string }) {
        const row = page.getByTestId('table-row').filter({ hasText: memberName });
        await expect(row).toBeVisible({ timeout: 30_000 });
        await row.click();

        await page.getByTestId('edit-member-button').click();

        const editView = page.getByTestId('member-step');
        await expect(editView).toBeVisible();
        return editView;
    }

    /** Opens the member's edit view, which contains the parents section */
    async function openMemberEditView({ page, scenario, memberName }: { page: Page; scenario: Scenario; memberName: string }) {
        await openMembersList({ page, scenario });
        return await openMemberEditViewFromList({ page, memberName });
    }

    async function openParentEditView({ page, editView, parentName }: { page: Page; editView: Locator; parentName: string }) {
        const row = editView.getByTestId('parent-row').filter({ hasText: parentName });
        await expect(row).toBeVisible();
        await row.getByTestId('edit-parent-button').click();

        // Level 1: the member edit view behind it also lists the parent's name, in a lower heading
        const parentView = page.getByTestId('save-view').filter({ has: page.getByRole('heading', { level: 1, name: new RegExp(parentName) }) });
        await expect(parentView).toBeVisible();
        return parentView;
    }

    function nationalRegisterNumberInput(parentView: Locator) {
        // NRNInput forwards $attrs, so the testid lands on the wrapper as well as the input
        return parentView.locator('input[data-testid="national-register-number-input"]');
    }

    async function saveView(view: Locator) {
        await view.getByTestId('save-button').first().click();
    }

    /** Saves the member step and waits for it to close, so the page underneath is usable again */
    async function saveMemberStep(step: Locator) {
        await saveView(step);
        await expect(step).toBeHidden({ timeout: 20_000 });
    }

    async function loginToPortal({ page, scenario }: { page: Page; scenario: Scenario }) {
        await page.goto(WorkerData.urls.registration(scenario.organization.uri) + '/leden');
        await page.getByTestId('open-login-button').click();
        await page.getByTestId('email-input').fill(scenario.portalUser.email);
        await page.getByTestId('password-input').fill(PORTAL_PASSWORD);
        await page.getByTestId('login-button').click();
        await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });
    }

    /** Opens the portal's 'Gegevens nakijken' page, which lists the family's parents */
    async function openCheckData({ page }: { page: Page }) {
        await page.getByTestId('check-data-button').click();
        await expect(page.getByTestId('check-data-parent-row').first()).toBeVisible({ timeout: 30_000 });
    }

    /**
     * Opens a parent from that page. The list collapses the per-member copies of a parent into
     * one, and the editor gets no member at all.
     */
    async function openParentFromCheckData({ page, parentName }: { page: Page; parentName: string }) {
        const row = page.getByTestId('check-data-parent-row').filter({ hasText: parentName });
        await expect(row).toBeVisible({ timeout: 30_000 });
        await row.click();

        // Level 1: the member edit view behind it also lists the parent's name, in a lower heading
        const parentView = page.getByTestId('save-view').filter({ has: page.getByRole('heading', { level: 1, name: new RegExp(parentName) }) });
        await expect(parentView).toBeVisible();
        return parentView;
    }

    async function readTaxDependent(memberId: string, parentId: string) {
        const member = await Member.getByID(memberId);
        return member!.details.parents.find(p => p.id === parentId)?.isMemberTaxDependent ?? null;
    }

    /**
     * Registers a member that has no registration yet. The item sits in pendingRegisterItems
     * while the member steps run, so this is the flow where the cart is the only signal.
     */
    async function startFirstRegistration({ page, memberName }: { page: Page; memberName: string }) {
        await page.getByTestId('register-member-button').first().click();

        const memberButton = page.getByTestId('member-button').filter({ hasText: memberName });
        await expect(memberButton).toBeVisible({ timeout: 30_000 });
        await memberButton.click();

        const groupButton = page.getByTestId('group-button').filter({ hasText: 'Kapoenen' });
        await expect(groupButton).toBeVisible({ timeout: 30_000 });
        await groupButton.click();

        // Confirms the group and puts the item in pendingRegisterItems, which starts the member steps
        await page.getByTestId('save-view').last().getByTestId('save-button').first().click();
    }

    /**
     * Walks the member steps until the parents step shows up, so the tests don't depend on
     * which other steps the records configuration happens to enable.
     */
    async function openParentsStepDuringRegistration({ page }: { page: Page }) {
        const parentsStep = page.getByTestId('member-step').filter({ has: page.getByTestId('parent-row') });

        for (let i = 0; i < 6; i++) {
            if (await parentsStep.first().isVisible().catch(() => false)) {
                return parentsStep.first();
            }

            const current = page.getByTestId('member-step').last();
            await expect(current).toBeVisible({ timeout: 30_000 });
            await saveView(current);

            // Either the next step replaces this one, or the parents step appears
            await expect(async () => {
                expect(await parentsStep.first().isVisible() || await current.isHidden()).toBe(true);
            }).toPass({ timeout: 20_000 });
        }

        throw new Error('The parents step never appeared while registering');
    }

    // ------------------------------------------------------------------
    // The organization setting itself
    // ------------------------------------------------------------------

    /** Opens Instellingen > Ledenadministratie > Persoonsgegevens */
    async function openRecordsSettings({ page, scenario }: { page: Page; scenario: Scenario }) {
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}/instellingen/ledenadministratie/persoonsgegevens`);

        const settings = page.getByTestId('save-view').filter({ has: page.getByTestId('records-property-parents') });
        await expect(settings).toBeVisible({ timeout: 30_000 });
        return settings;
    }

    function settingRow(settings: Locator, property: string) {
        return settings.getByTestId(`records-property-${property}`);
    }

    /** Ticking a property opens its filter dialog first, so accept the default configuration */
    async function enableSettingProperty({ page, settings, property }: { page: Page; settings: Locator; property: string }) {
        const views = page.getByTestId('save-view');
        const before = await views.count();

        await settingRow(settings, property).getByTestId('checkbox').click();
        await expect(views).toHaveCount(before + 1);

        await views.nth(before).getByTestId('save-button').first().click();
        await expect(views).toHaveCount(before, { timeout: 15_000 });
    }

    test('the tax certificate setting sits right before the national register number', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxCertificates: false, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const settings = await openRecordsSettings({ page, scenario });

        await expect(settingRow(settings, 'nationalRegisterNumber').getByTestId('checkbox')).toBeChecked();
        await expect(settingRow(settings, 'taxCertificates')).toBeVisible();

        const rows = settings.locator('[data-testid^="records-property-"]');
        const order = await rows.evaluateAll(elements => elements.map(e => e.getAttribute('data-testid')));
        expect(order.indexOf('records-property-taxCertificates')).toBe(order.indexOf('records-property-nationalRegisterNumber') - 1);
    });

    test('the tax certificate setting stands on its own, without the national register number', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const settings = await openRecordsSettings({ page, scenario });
        await expect(settingRow(settings, 'taxCertificates').getByTestId('checkbox')).toBeChecked();

        // It collects its own numbers, so turning the plain question off leaves it alone
        await settingRow(settings, 'nationalRegisterNumber').getByTestId('checkbox').click();
        await expect(settingRow(settings, 'nationalRegisterNumber').getByTestId('checkbox')).not.toBeChecked();

        await expect(settingRow(settings, 'taxCertificates')).toBeVisible();
        await expect(settingRow(settings, 'taxCertificates').getByTestId('checkbox')).toBeChecked();
    });

    test('turning off the parents leaves the tax dependent setting alone', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const settings = await openRecordsSettings({ page, scenario });
        await expect(settingRow(settings, 'taxCertificates').getByTestId('checkbox')).toBeChecked();

        // Only the national register number decides whether the question is offered
        await settingRow(settings, 'parents').getByTestId('checkbox').click();
        await expect(settingRow(settings, 'parents').getByTestId('checkbox')).not.toBeChecked();

        await expect(settingRow(settings, 'taxCertificates')).toBeVisible();
        await expect(settingRow(settings, 'taxCertificates').getByTestId('checkbox')).toBeChecked();
    });

    test('the tax certificate setting stays stored when the national register number is turned off', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const settings = await openRecordsSettings({ page, scenario });
        await settingRow(settings, 'nationalRegisterNumber').getByTestId('checkbox').click();
        await expect(settingRow(settings, 'taxCertificates').getByTestId('checkbox')).toBeChecked();

        await saveView(settings);

        await expect.poll(async () => {
            const organization = await OrganizationModel.getByID(scenario.organization.id);
            return organization!.meta.recordsConfiguration.taxCertificates;
        }, { timeout: 20_000 }).toBe(true);
    });

    // ------------------------------------------------------------------
    // The tax certificate section: the member's number and the debtor
    // ------------------------------------------------------------------

    function taxBox(view: Locator) {
        return view.getByTestId('tax-certificate-box');
    }

    function memberNrnInput(view: Locator) {
        // NRNInput forwards $attrs, so the testid lands on the wrapper as well as the input
        return view.locator('input[data-testid="member-nrn-input"]');
    }

    function debtorRow(view: Locator, parentName: string) {
        return taxBox(view).getByTestId('debtor-row').filter({ hasText: parentName });
    }

    function debtorRadio(view: Locator, parentName: string) {
        return debtorRow(view, parentName).locator('input[type="radio"]');
    }

    /** The clickable part of the radio; the input itself is hidden behind the custom styling */
    function debtorRadioLabel(view: Locator, parentName: string) {
        return debtorRow(view, parentName).locator('label.radio');
    }

    function debtorCheckbox(view: Locator, parentName: string) {
        return debtorRow(view, parentName).getByTestId('checkbox');
    }

    function debtorNrnInput(view: Locator, parentName: string) {
        return debtorRow(view, parentName).locator('input[data-testid="debtor-nrn-input"]');
    }

    function coParentingCheckbox(view: Locator) {
        return taxBox(view).getByTestId('co-parenting-row').getByTestId('checkbox');
    }

    /** Searched in the whole view: the section header the toggle sits in may be rendered outside the section */
    function severeDisabilityToggle(view: Locator) {
        return view.getByTestId('severe-disability-toggle');
    }

    /** Opens the step the portal offers to complete the missing data of a member */
    async function openMissingDataStep({ page, memberName }: { page: Page; memberName: string }) {
        const quickAction = page.getByTestId('quick-action').filter({ hasText: new RegExp(memberName) });
        await expect(quickAction).toBeVisible({ timeout: 30_000 });
        await quickAction.click();

        const step = page.getByTestId('member-step');
        await expect(step).toBeVisible();
        return step;
    }

    /**
     * Saves member steps until one contains the tax certificate section. Returns null once the
     * steps run out without it, so a test can assert the section was never asked.
     */
    async function walkToTaxCertificateStep({ page }: { page: Page }): Promise<Locator | null> {
        const taxStep = page.getByTestId('member-step').filter({ has: page.getByTestId('tax-certificate-box') });

        for (let i = 0; i < 8; i++) {
            if (await taxStep.first().isVisible().catch(() => false)) {
                return taxStep.first();
            }

            const current = page.getByTestId('member-step').last();

            if (!await current.isVisible().catch(() => false)) {
                // The next step may still be on its way, so only give up when nothing shows up
                await page.waitForTimeout(2_000);
                if (!await current.isVisible().catch(() => false)) {
                    return null;
                }
            }

            // Pin the element: the locator would resolve to the next step once that is pushed
            const currentElement = await current.elementHandle();
            await saveView(current);

            // Either the next step replaces this one, or the tax certificate step appears
            await expect(async () => {
                expect(await taxStep.first().isVisible() || !await currentElement!.isVisible()).toBe(true);
            }).toPass({ timeout: 20_000 });
        }

        throw new Error('The member steps never ended');
    }

    async function readNationalRegisterNumber(memberId: string) {
        const member = await Member.getByID(memberId);
        return member!.details.nationalRegisterNumber;
    }

    // The UI keeps the national register number ticked alongside it, but the API does not have to
    test('with only the tax certificate setting, the member and the debtor are still asked', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxCertificates: true,
            nationalRegisterNumbers: { mother: null, father: null },
            memberNationalRegisterNumberFilter: false,
        });

        await loginToPortal({ page, scenario });
        const step = await openMissingDataStep({ page, memberName: scenario.names.memberA });

        await expect(taxBox(step)).toBeVisible();
        await expect(memberNrnInput(step)).toBeVisible();

        await expect(debtorNrnInput(step, scenario.names.mother)).toBeHidden();
        await debtorRadioLabel(step, scenario.names.mother).click();
        await expect(debtorNrnInput(step, scenario.names.mother)).toBeVisible();
    });

    // ------------------------------------------------------------------
    // Only the national register number is enabled on the organization
    // ------------------------------------------------------------------

    test('with only NRN enabled, there is no tax certificate section and parents are not asked for a number', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxCertificates: false, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        // The member's own number stays in the general section
        await expect(memberNrnInput(editView)).toBeVisible();
        await expect(taxBox(editView)).toBeHidden();

        // The toggle is off, so we stop asking parents for a national register number entirely
        const parentView = await openParentEditView({ page, editView, parentName: scenario.names.mother });
        await expect(nationalRegisterNumberInput(parentView)).toBeHidden();
    });

    test('with only NRN enabled, an already stored number stays visible so it can be corrected', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxCertificates: false, nationalRegisterNumbers: { mother: VALID_NRN_A, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const motherView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        await expect(nationalRegisterNumberInput(motherView)).toBeVisible();
        await expect(nationalRegisterNumberInput(motherView)).toHaveValue(/93\.04\.20-001\.22|93042000122/);
    });

    test('each tax dependent parent stays required on the data check page, whichever sibling claims them', async ({ page }) => {
        test.setTimeout(180_000);
        // Each parent has the member tax dependent for a different sibling
        const scenario = await seedScenario({
            taxCertificates: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: VALID_NRN_B },
            taxDependentPerMember: {
                memberA: { mother: true },
                memberB: { father: true },
            },
        });

        await loginToPortal({ page, scenario });
        await openCheckData({ page });

        // 'Gegevens nakijken' keeps only one copy of each parent, so neither may fall back to optional
        for (const parentName of [scenario.names.mother, scenario.names.father]) {
            const parentView = await openParentFromCheckData({ page, parentName });
            await expect(nationalRegisterNumberInput(parentView)).toHaveAttribute('placeholder', 'JJ.MM.DD-XXX.XX');

            await page.keyboard.press('Escape');
            await expect(parentView).toBeHidden({ timeout: 15_000 });
        }
    });

    test('a number the children depend on cannot be cleared, and the error says who needs it', async ({ page }) => {
        test.setTimeout(180_000);
        // The mother has both children tax dependent, and only she has a number
        const scenario = await seedScenario({
            taxCertificates: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: null },
            taxDependentParents: { mother: true },
        });

        // Admins get every field as optional, so this only shows up in the portal
        await loginToPortal({ page, scenario });
        await openCheckData({ page });

        const motherView = await openParentFromCheckData({ page, parentName: scenario.names.mother });
        await expect(nationalRegisterNumberInput(motherView)).toHaveAttribute('placeholder', 'JJ.MM.DD-XXX.XX');

        // Clearing it has to be refused, and the error has to name the children that need it
        await nationalRegisterNumberInput(motherView).fill('');
        await saveView(motherView);

        await expect(motherView).toBeVisible();

        const error = motherView.getByText(/vul een rijksregisternummer in/i).first();
        await expect(error).toBeVisible();
        await expect(error).toContainText(scenario.names.memberA);
        await expect(error).toContainText(scenario.names.memberB);
    });

    test('clearing the number to correct it keeps the field on screen', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxCertificates: false, nationalRegisterNumbers: { mother: VALID_NRN_A, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const motherView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        // Correcting a number starts by emptying the field, which must not hide it
        await nationalRegisterNumberInput(motherView).fill('');
        await expect(nationalRegisterNumberInput(motherView)).toBeVisible();

        await nationalRegisterNumberInput(motherView).fill(VALID_NRN_B);
        await expect(nationalRegisterNumberInput(motherView)).toHaveValue(/93\.04\.20-002\.21|93042000221/);
    });

    // ------------------------------------------------------------------
    // Both the national register number and tax certificates are enabled
    // ------------------------------------------------------------------

    test('with both enabled, a parent\'s number is only asked once that parent is chosen as debtor', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        await expect(debtorRadio(editView, scenario.names.mother)).not.toBeChecked();
        await expect(debtorRadio(editView, scenario.names.father)).not.toBeChecked();
        await expect(debtorNrnInput(editView, scenario.names.mother)).toBeHidden();
        await expect(debtorNrnInput(editView, scenario.names.father)).toBeHidden();

        await debtorRadioLabel(editView, scenario.names.mother).click();
        await expect(debtorNrnInput(editView, scenario.names.mother)).toBeVisible();
        await expect(debtorNrnInput(editView, scenario.names.father)).toBeHidden();

        // And moves along with the choice
        await debtorRadioLabel(editView, scenario.names.father).click();
        await expect(debtorNrnInput(editView, scenario.names.mother)).toBeHidden();
        await expect(debtorNrnInput(editView, scenario.names.father)).toBeVisible();
    });

    test('the member portal asks nothing when the member is too old for a fiscal certificate', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null }, profile: TOO_OLD });

        await loginToPortal({ page, scenario });

        // Nothing is missing, so the only quick action left asks to add the account's e-mail address
        const step = await openMissingDataStep({ page, memberName: scenario.names.memberA });

        await expect(memberNrnInput(step)).toBeVisible();
        await expect(taxBox(step)).toBeHidden();
    });

    test('an administrator can still collect the data of a member too old for a fiscal certificate', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null }, profile: TOO_OLD });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        // Only the age toggle is offered, to extend the certificate for a severe disability
        await expect(taxBox(editView)).toBeVisible();
        await expect(severeDisabilityToggle(editView)).toHaveText(/Tot 14 jaar/);
        await expect(debtorRow(editView, scenario.names.mother)).toBeHidden();

        await severeDisabilityToggle(editView).click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Tot 21 jaar' }).click();

        // Confirming the disability asks to tick a checkbox first
        const confirm = page.getByTestId('centered-message');
        await expect(confirm).toBeVisible();
        await confirm.getByTestId('checkbox').click();
        await confirm.getByTestId('centered-message-button').filter({ hasText: 'Uitreiken tot 21 jaar' }).click();
        await expect(confirm).toBeHidden();

        await expect(severeDisabilityToggle(editView)).toHaveText(/Tot 21 jaar/);
        await expect(debtorRadio(editView, scenario.names.mother)).toBeAttached();
    });

    test('a member over 14 with a severe disability is still asked', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null }, profile: DISABLED });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        // Same age as the TOO_OLD member, but the disability raises the limit to 21
        await expect(taxBox(editView)).toBeVisible();
        await expect(severeDisabilityToggle(editView)).toHaveText(/Tot 21 jaar/);

        await debtorRadioLabel(editView, scenario.names.mother).click();
        await expect(debtorNrnInput(editView, scenario.names.mother)).toBeVisible();
    });

    test('opting the member out of a national register number drops the debtor question', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        await expect(debtorRow(editView, scenario.names.mother)).toBeVisible();

        await taxBox(editView).getByRole('button', { name: /klik dan hier/i }).click();
        await expect(debtorRow(editView, scenario.names.mother)).toBeHidden();

        await saveMemberStep(editView);

        await expect.poll(async () => await readNationalRegisterNumber(scenario.memberA.id), { timeout: 20_000 }).toBe(NationalRegisterNumberOptOut);
    });

    // ------------------------------------------------------------------
    // The debtor must stay per member, never copied to a sibling
    // ------------------------------------------------------------------

    test('choosing the debtor for one child leaves the sibling untouched, also after a reload', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        await debtorRadioLabel(editView, scenario.names.mother).click();
        await debtorNrnInput(editView, scenario.names.mother).fill(VALID_NRN_A);
        await saveMemberStep(editView);

        // The backend stores it for this member only
        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.motherId), { timeout: 20_000 }).toBe(true);
        expect(await readTaxDependent(scenario.memberB.id, scenario.motherId)).toBeNull();

        // The sibling shows it unticked in the state the frontend still holds, without reloading
        await closeMemberDetailView({ page });
        const liveSiblingEdit = await openMemberEditViewFromList({ page, memberName: scenario.names.memberB });
        await expect(debtorRadio(liveSiblingEdit, scenario.names.mother)).not.toBeChecked();

        // Close again without saving, so the reload starts from a clean state
        await liveSiblingEdit.getByTestId('close-button').first().click();
        await expect(liveSiblingEdit).toBeHidden({ timeout: 15_000 });

        // And still unticked after a full reload, so the backend agrees with the frontend
        const siblingEdit = await openMemberEditView({ page, scenario, memberName: scenario.names.memberB });
        await expect(debtorRadio(siblingEdit, scenario.names.mother)).not.toBeChecked();
        await expect(debtorRadio(siblingEdit, scenario.names.father)).not.toBeChecked();
    });

    test('each child can have a different debtor', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxCertificates: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editA = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        await debtorRadioLabel(editA, scenario.names.mother).click();
        await debtorNrnInput(editA, scenario.names.mother).fill(VALID_NRN_A);
        await saveMemberStep(editA);

        const editB = await openMemberEditView({ page, scenario, memberName: scenario.names.memberB });
        await debtorRadioLabel(editB, scenario.names.father).click();
        await debtorNrnInput(editB, scenario.names.father).fill(VALID_NRN_B);
        await saveMemberStep(editB);

        await expect.poll(async () => await readTaxDependent(scenario.memberB.id, scenario.fatherId), { timeout: 20_000 }).toBe(true);

        // Choosing a debtor answers the question for the other parent too, with an explicit no
        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(true);
        expect(await readTaxDependent(scenario.memberA.id, scenario.fatherId)).toBe(false);
        expect(await readTaxDependent(scenario.memberB.id, scenario.motherId)).toBe(false);
    });

    // ------------------------------------------------------------------
    // Two debtors only make sense with fiscal co-parenting
    // ------------------------------------------------------------------

    test('ticking co-parenting makes both parents debtor and asks the second number too', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxCertificates: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: null },
            taxDependentParents: { mother: true },
        });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        await expect(coParentingCheckbox(editView)).not.toBeChecked();
        await expect(debtorNrnInput(editView, scenario.names.father)).toBeHidden();

        await coParentingCheckbox(editView).click();
        await expect(coParentingCheckbox(editView)).toBeChecked();

        await expect(debtorNrnInput(editView, scenario.names.mother)).toHaveValue(/93\.04\.20-001\.22|93042000122/);
        await expect(debtorNrnInput(editView, scenario.names.father)).toBeVisible();

        await debtorNrnInput(editView, scenario.names.father).fill(VALID_NRN_B);
        await saveMemberStep(editView);

        // Both parents are tax dependent now, which is what co-parenting means
        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.fatherId), { timeout: 20_000 }).toBe(true);
        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(true);
    });

    test('unticking co-parenting keeps a single debtor', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxCertificates: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: VALID_NRN_B },
            taxDependentParents: { mother: true, father: true },
        });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        // Two stored debtors show up as co-parenting
        await expect(coParentingCheckbox(editView)).toBeChecked();

        await coParentingCheckbox(editView).click();
        await expect(coParentingCheckbox(editView)).not.toBeChecked();
        await expect(debtorRadio(editView, scenario.names.mother)).toBeChecked();
        await expect(debtorRadio(editView, scenario.names.father)).not.toBeChecked();

        await saveMemberStep(editView);

        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.fatherId), { timeout: 20_000 }).toBe(false);
        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(true);
    });

    test('a third parent cannot become a debtor as well', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxCertificates: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: VALID_NRN_B },
            taxDependentParents: { mother: true, father: true },
            withThirdParent: true,
        });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });

        // With three parents, co-parenting offers a checkbox per parent
        await expect(coParentingCheckbox(editView)).toBeChecked();
        await expect(debtorCheckbox(editView, scenario.names.thirdParent)).not.toBeChecked();

        await debtorCheckbox(editView, scenario.names.thirdParent).click();
        await expect(debtorCheckbox(editView, scenario.names.thirdParent)).toBeChecked();

        // Saving has to be refused
        await saveView(editView);
        await expect(editView).toBeVisible();
        await expect(editView.getByText(/maximaal twee ouders/i).first()).toBeVisible();

        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(true);
    });

    test('moving the debtor to the other parent makes that parent\'s number required', async ({ page }) => {
        test.setTimeout(180_000);
        // The mother has the member tax dependent, but nobody has a number yet
        const scenario = await seedScenario({
            taxCertificates: true,
            nationalRegisterNumbers: { mother: null, father: null },
            taxDependentParents: { mother: true },
        });

        // Admins get every field as optional, so this only shows up in the portal
        await loginToPortal({ page, scenario });
        const step = await openMissingDataStep({ page, memberName: scenario.names.memberA });

        await expect(debtorRadio(step, scenario.names.mother)).toBeChecked();

        // The father now carries it, so his number is required
        await debtorRadioLabel(step, scenario.names.father).click();
        await expect(debtorRadio(step, scenario.names.mother)).not.toBeChecked();
        await expect(debtorNrnInput(step, scenario.names.father)).toBeVisible();

        // Saving without one has to fail
        await saveView(step);
        await expect(step).toBeVisible();
        await expect(step.getByText(/vul een rijksregisternummer in/i).first()).toBeVisible();

        await debtorNrnInput(step, scenario.names.father).fill(VALID_NRN_B);
        await saveMemberStep(step);

        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.fatherId), { timeout: 20_000 }).toBe(true);
        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(false);
    });

    test('a number on a parent that is not the debtor does not complete the member', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxCertificates: true,
            // The mother has a number, but nobody has the member tax dependent
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: null },
        });

        await loginToPortal({ page, scenario });

        // The missing debtor surfaces as a quick action
        const step = await openMissingDataStep({ page, memberName: scenario.names.memberA });

        // Saving has to be refused: the stored number belongs to nobody in particular
        await saveView(step);
        await expect(step).toBeVisible();
        await expect(step.getByText(/schuldenaar/i).first()).toBeVisible();

        // Choosing the parent that already has the number resolves it
        await debtorRadioLabel(step, scenario.names.mother).click();
        await expect(debtorNrnInput(step, scenario.names.mother)).toHaveValue(/93\.04\.20-001\.22|93042000122/);
        await saveMemberStep(step);

        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.motherId), { timeout: 20_000 }).toBe(true);
        expect(await readTaxDependent(scenario.memberB.id, scenario.motherId)).toBeNull();
    });

    // ------------------------------------------------------------------
    // A member registering for the first time has no registration yet,
    // only the item that is being registered
    // ------------------------------------------------------------------

    test.describe('first registration', () => {
        async function startRegistrationInPortal({ page, scenario }: { page: Page; scenario: Scenario }) {
            await loginToPortal({ page, scenario });
            await startFirstRegistration({ page, memberName: scenario.names.memberA });
        }

        test('asks to choose a debtor while registering for the first time', async ({ page }) => {
            test.setTimeout(150_000);
            const scenario = await seedScenario({
                taxCertificates: true,
                nationalRegisterNumbers: { mother: null, father: null },
                withRegistrations: false,
            });

            await startRegistrationInPortal({ page, scenario });
            const step = await walkToTaxCertificateStep({ page });
            expect(step).not.toBeNull();

            // And it still gates the national register number the same way
            await expect(debtorNrnInput(step!, scenario.names.mother)).toBeHidden();
            await debtorRadioLabel(step!, scenario.names.mother).click();
            await expect(debtorNrnInput(step!, scenario.names.mother)).toBeVisible();
        });

        test('asks a member over 14 with a severe disability', async ({ page }) => {
            test.setTimeout(150_000);
            const scenario = await seedScenario({
                taxCertificates: true,
                nationalRegisterNumbers: { mother: null, father: null },
                profile: DISABLED,
                withRegistrations: false,
            });

            await startRegistrationInPortal({ page, scenario });
            const step = await walkToTaxCertificateStep({ page });
            expect(step).not.toBeNull();
            await expect(debtorRow(step!, scenario.names.mother)).toBeVisible();
        });

        test('asks nothing when the member is too old for a fiscal certificate', async ({ page }) => {
            test.setTimeout(150_000);
            const scenario = await seedScenario({
                taxCertificates: true,
                nationalRegisterNumbers: { mother: null, father: null },
                profile: TOO_OLD,
                withRegistrations: false,
            });

            await startRegistrationInPortal({ page, scenario });
            expect(await walkToTaxCertificateStep({ page })).toBeNull();
        });

        test('asks nothing when the organization did not enable the setting', async ({ page }) => {
            test.setTimeout(150_000);
            const scenario = await seedScenario({
                taxCertificates: false,
                nationalRegisterNumbers: { mother: null, father: null },
                withRegistrations: false,
            });

            await startRegistrationInPortal({ page, scenario });
            expect(await walkToTaxCertificateStep({ page })).toBeNull();
        });

        test('a parent added to the whole family can become the debtor of the edited member only', async ({ page }) => {
            test.setTimeout(180_000);
            const scenario = await seedScenario({
                taxCertificates: true,
                nationalRegisterNumbers: { mother: null, father: null },
                withRegistrations: false,
            });

            // The portal is where a parent manages the whole family, so the siblings are loaded
            await startRegistrationInPortal({ page, scenario });
            const parentsStep = await openParentsStepDuringRegistration({ page });

            await parentsStep.getByTestId('add-parent-button').click();

            const newParentName = `Plusouder${Date.now()}`;
            const parentView = page.getByTestId('save-view').last();
            await parentView.locator('input[autocomplete="given-name"]').fill(newParentName);
            await parentView.locator('input[autocomplete="family-name"]').fill('Doe');
            await parentView.locator('input[type="tel"]').first().fill('+32498765432');
            await parentView.getByTestId('email-input').first().fill(`plusouder-${Date.now()}@example.com`);

            // Reuse the address the other parents already have
            await parentView.locator('.address-selection').first().click();

            // The parent view no longer asks about the certificate, that comes in its own step
            await expect(nationalRegisterNumberInput(parentView)).toBeHidden();
            await saveView(parentView);

            // Confirm adding the parent to the other family member as well
            const confirm = page.getByTestId('centered-message');
            await expect(confirm).toBeVisible({ timeout: 15_000 });
            await confirm.getByTestId('centered-message-button').first().click();
            await expect(parentView).toBeHidden({ timeout: 15_000 });

            const step = await walkToTaxCertificateStep({ page });
            expect(step).not.toBeNull();

            await debtorRadioLabel(step!, newParentName).click();
            await debtorNrnInput(step!, newParentName).fill(VALID_NRN_A);
            await saveView(step!);
            await expect(step!).toBeHidden({ timeout: 20_000 });

            await expect.poll(async () => {
                const member = await Member.getByID(scenario.memberA.id);
                return member!.details.parents.find(p => p.firstName === newParentName)?.isMemberTaxDependent ?? null;
            }, { timeout: 30_000 }).toBe(true);

            // The sibling got the parent too, but never the tax dependency
            const sibling = await Member.getByID(scenario.memberB.id);
            const copied = sibling!.details.parents.find(p => p.firstName === newParentName);
            expect(copied).toBeDefined();
            expect(copied!.isMemberTaxDependent).toBeNull();
        });
    });
});
